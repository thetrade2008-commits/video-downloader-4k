const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const app = express();
const PORT = 3000;

app.use(express.json());

/* ================= CORS ================= */

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

/* ================= STATIC FILES ================= */

app.use(express.static(__dirname));

/* ================= YT-DLP HELPER ================= */

function runYtDlp(args) {
    return new Promise((resolve, reject) => {
        const process = spawn("yt-dlp", args);

        let stdout = "";
        let stderr = "";

        process.stdout.on("data", data => {
            stdout += data.toString();
        });

        process.stderr.on("data", data => {
            stderr += data.toString();
        });

        process.on("error", reject);

        process.on("close", code => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(
                    stderr.trim() || `yt-dlp exited with code ${code}`
                ));
            }
        });
    });
}

/* ================= FORMAT HELPERS ================= */

function getVideoQuality(format) {
    const width = Number(format.width) || 0;
    const height = Number(format.height) || 0;

    if (width && height) {
        return Math.min(width, height);
    }

    const resolution = String(format.resolution || "");
    const match = resolution.match(/(\d+)x(\d+)/);

    if (match) {
        return Math.min(
            Number(match[1]),
            Number(match[2])
        );
    }

    return width || height || 0;
}

function hasVideoCodec(format) {
    return Boolean(
        format.vcodec &&
        format.vcodec !== "none"
    );
}

function hasAudioCodec(format) {
    return Boolean(
        format.acodec &&
        format.acodec !== "none"
    );
}

/* ================= STATUS ================= */

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "Video Downloader 4K backend is running"
    });
});

/* ================= VIDEO INFORMATION ================= */

app.get("/api/info", async (req, res) => {
    const url = String(req.query.url || "").trim();

    if (!url) {
        return res.status(400).json({
            success: false,
            message: "Video URL is required"
        });
    }

    try {
        const parsedUrl = new URL(url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Invalid protocol");
        }
    } catch {
        return res.status(400).json({
            success: false,
            message: "Invalid video URL"
        });
    }

    try {
        const result = await runYtDlp([
            "--remote-components",
            "ejs:github",
            "--dump-single-json",
            "--skip-download",
            "--no-playlist",
            url
        ]);

        const info = JSON.parse(result.stdout);

        const formats = Array.isArray(info.formats)
            ? info.formats
            : [];

        // Video aur audio ko separately check karo.
        const videoFormats = formats.filter(hasVideoCodec);
        const audioFormats = formats.filter(hasAudioCodec);

        const hasVideo = videoFormats.length > 0;
        const hasAudio = audioFormats.length > 0;

        // Standard available video qualities.
        const qualities = [360, 480, 720, 1080, 2160];

        const availableQualities = qualities
            .filter(quality => {
                return videoFormats.some(format => {
                    return getVideoQuality(format) >= quality;
                });
            })
            .map(height => ({
                format: "mp4",
                quality: `${height}p`,
                height,
                available: true
            }));

        res.json({
            success: true,
            title: info.title || "Media",
            thumbnail: info.thumbnail || null,
            duration: info.duration || null,
            uploader: info.uploader || null,

            hasVideo,
            hasAudio,

            // Audio-only content par bhi MP3 available rahega.
            audioOnly: !hasVideo && hasAudio,
            mp3: hasAudio,

            qualities: availableQualities
        });

    } catch (error) {
        console.error("Info error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message || "Unable to get media information"
        });
    }
});

/* ================= DOWNLOAD ================= */

app.get("/api/download", async (req, res) => {
    const url = String(req.query.url || "").trim();
    const format = String(req.query.format || "mp4").trim().toLowerCase();
    const quality = String(req.query.quality || "").trim().toLowerCase();

    if (!url) {
        return res.status(400).json({
            success: false,
            message: "Video URL is required"
        });
    }

    try {
        const parsedUrl = new URL(url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Invalid protocol");
        }
    } catch {
        return res.status(400).json({
            success: false,
            message: "Invalid video URL"
        });
    }

    let formatSelector = "";
    let audioQuality = "128K";

    /* ================= FORMAT VALIDATION ================= */

    if (format === "mp3") {
        audioQuality =
            quality === "320k" ? "320K" :
            quality === "192k" ? "192K" :
            "128K";
    }

    else if (format === "mp4") {
        if (quality === "best") {
            formatSelector =
                "bestvideo[ext=mp4]+bestaudio/best[ext=mp4]";
        } else {
            const height = parseInt(
                quality.replace("p", ""),
                10
            );

            if (
                !Number.isInteger(height) ||
                ![360, 480, 720, 1080, 2160].includes(height)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid video quality"
                });
            }

            formatSelector =
                `bestvideo[height<=${height}][ext=mp4]+bestaudio/` +
                `bestvideo[width<=${height}][ext=mp4]+bestaudio/` +
                `best[height<=${height}][ext=mp4]/` +
                `best[width<=${height}][ext=mp4]`;
        }
    }

    else {
        return res.status(400).json({
            success: false,
            message: "Invalid download format"
        });
    }

    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "video-downloader-")
    );

    try {
        const outputTemplate = path.join(
            tempDir,
            "%(title)s.%(ext)s"
        );

        /* ================= MP3 DOWNLOAD ================= */

        if (format === "mp3") {
            await runYtDlp([
                "--remote-components",
                "ejs:github",
                "--no-playlist",
                "-f",
                "bestaudio/best",
                "-x",
                "--audio-format",
                "mp3",
                "--audio-quality",
                audioQuality,
                "-o",
                outputTemplate,
                url
            ]);
        }

        /* ================= MP4 DOWNLOAD ================= */

        else {
            await runYtDlp([
                "--remote-components",
                "ejs:github",
                "--no-playlist",
                "-f",
                formatSelector,
                "--merge-output-format",
                "mp4",
                "-o",
                outputTemplate,
                url
            ]);
        }

        /* ================= FIND DOWNLOADED FILE ================= */

        const files = fs.readdirSync(tempDir).filter(file => {
            return (
                !file.endsWith(".part") &&
                !file.endsWith(".ytdl") &&
                !file.endsWith(".temp")
            );
        });

        if (files.length === 0) {
            throw new Error("Downloaded file was not created");
        }

        const filePath = path.join(tempDir, files[0]);
        const filename = path.basename(filePath);

        /* ================= SEND FILE ================= */

        res.download(filePath, filename, error => {
            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });

            if (error) {
                console.error("Send error:", error.message);
            }
        });

    } catch (error) {
        console.error("Download error:", error.message);

        fs.rmSync(tempDir, {
            recursive: true,
            force: true
        });

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: error.message || "Unable to download this media"
            });
        }
    }
});

/* ================= START SERVER ================= */

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("=================================");
    console.log("  Video Downloader 4K");
    console.log("  Backend is running");
    console.log("=================================");
    console.log(`Local: http://127.0.0.1:${PORT}`);
    console.log("");
});

server.on("error", error => {
    console.error("SERVER ERROR:", error.message);
});