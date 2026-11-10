/* =========================================
   VIDEO DOWNLOADER 4K
   Complete script.js
========================================= */

const API_BASE = "http://127.0.0.1:3000";


/* =========================================
   HTML ELEMENTS
========================================= */

const videoUrl = document.getElementById("videoUrl");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");

const statusText = document.getElementById("statusText");
const statusDot = document.querySelector(".status-dot");

const downloadResult = document.getElementById("downloadResult");
const videoTitle = document.getElementById("videoTitle");
const videoThumbnail = document.getElementById("videoThumbnail");
const thumbnailPlaceholder = document.getElementById("thumbnailPlaceholder");

const maxDownloadBtn = document.getElementById("maxDownloadBtn");


/* =========================================
   GLOBAL VARIABLES
========================================= */

let currentVideoInfo = null;
let isLoading = false;


/* =========================================
   EXTRA CSS
========================================= */

const extraStyle = document.createElement("style");

extraStyle.textContent = `

.quality-download.unavailable {
    width: auto !important;
    min-width: 155px;
    max-width: 190px;
    padding: 6px 8px;
    background: #252d3b !important;
    color: #929cad !important;
    font-size: 9px !important;
    line-height: 1.3;
    cursor: not-allowed !important;
    opacity: 0.85;
    transform: none !important;
}

.quality-download.available {
    background: #6dff8b;
    color: #07100a;
}

.download-loading {
    opacity: 0.75 !important;
    pointer-events: none !important;
}

.button-spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: #07100a;
    border-radius: 50%;
    animation: downloadSpin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
}

@keyframes downloadSpin {
    to {
        transform: rotate(360deg);
    }
}

.download-popup {
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translate(-50%, -20px);
    width: calc(100% - 48px);
    max-width: 340px;
    padding: 11px 13px;
    background: #171f30;
    border: 1px solid #34415a;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 9px;
    z-index: 99999;
    opacity: 0;
    visibility: hidden;
    transition: all 0.25s ease;
    box-shadow: 0 8px 25px rgba(0,0,0,0.35);
    font-family: Arial, sans-serif;
}

.download-popup.show {
    opacity: 1;
    visibility: visible;
    transform: translate(-50%, 0);
}

.download-popup-icon {
    width: 31px;
    height: 31px;
    min-width: 31px;
    border-radius: 50%;
    background: #26354d;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}

.download-popup-content {
    flex: 1;
    min-width: 0;
}

.download-popup-title {
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 3px;
}

.download-popup-details {
    color: #aab6ca;
    font-size: 11px;
    line-height: 1.4;
}

.download-popup-spinner {
    width: 14px;
    height: 14px;
    min-width: 14px;
    border: 2px solid #53647e;
    border-top-color: #38a7ff;
    border-radius: 50%;
    animation: downloadSpin 0.7s linear infinite;
}

`;

document.head.appendChild(extraStyle);


/* =========================================
   POPUP CREATE
========================================= */

const popup = document.createElement("div");

popup.className = "download-popup";

popup.innerHTML = `
    <div class="download-popup-icon" id="popupIcon">
        ⬇️
    </div>

    <div class="download-popup-content">
        <div class="download-popup-title" id="popupTitle">
            Preparing download
        </div>

        <div class="download-popup-details" id="popupDetails">
            Please wait...
        </div>
    </div>

    <div class="download-popup-spinner" id="popupSpinner"></div>
`;

document.body.appendChild(popup);

const popupIcon = document.getElementById("popupIcon");
const popupTitle = document.getElementById("popupTitle");
const popupDetails = document.getElementById("popupDetails");
const popupSpinner = document.getElementById("popupSpinner");

let popupTimer = null;


function showDownloadPopup(title, details, type = "loading") {

    clearTimeout(popupTimer);

    popupTitle.textContent = title;
    popupDetails.textContent = details;

    if (type === "success") {

        popupIcon.textContent = "✓";
        popupSpinner.style.display = "none";

    } else if (type === "error") {

        popupIcon.textContent = "✕";
        popupSpinner.style.display = "none";

    } else {

        popupIcon.textContent = "⬇️";
        popupSpinner.style.display = "block";
    }

    popup.classList.add("show");

    if (type !== "loading") {

        popupTimer = setTimeout(() => {
            popup.classList.remove("show");
        }, 3500);
    }
}


/* =========================================
   STATUS
========================================= */

function setStatus(message, type = "normal") {

    if (statusText) {
        statusText.textContent = message;
    }

    if (statusDot) {

        statusDot.classList.remove(
            "online",
            "offline",
            "loading"
        );

        if (type === "loading") {

            statusDot.classList.add("loading");

        } else if (type === "error") {

            statusDot.classList.add("offline");

        } else {

            statusDot.classList.add("online");
        }
    }
}


/* =========================================
   BUTTON LOADING
========================================= */

function setDownloadButtonLoading(button, loading) {

    if (!button) return;

    if (loading) {

        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }

        button.classList.add("download-loading");

        button.innerHTML = `
            <span class="button-spinner"></span>
            Downloading...
        `;

        button.disabled = true;

    } else {

        button.classList.remove("download-loading");

        button.innerHTML =
            button.dataset.originalText || "Download";

        button.disabled = false;
    }
}


/* =========================================
   GET VIDEO INFORMATION
========================================= */

async function getVideoInfo(url) {

    const response = await fetch(
        `${API_BASE}/api/info?url=${encodeURIComponent(url)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {

        throw new Error(
            data.message || "Unable to get video information"
        );
    }

    return data;
}


/* =========================================
   QUALITY NORMALIZER
========================================= */

function normalizeQuality(value) {

    return String(value || "")
        .toLowerCase()
        .replace(/\s/g, "")
        .replace("p", "");
}


/* =========================================
   GET AVAILABLE VIDEO QUALITIES
========================================= */

function getAvailableQualities(data) {

    const qualities = Array.isArray(data.qualities)
        ? data.qualities
        : [];

    return qualities
        .filter(item => item.available !== false)
        .map(item => {

            const height = Number(
                item.height ||
                normalizeQuality(item.quality)
            );

            return height;
        })
        .filter(height => Number.isFinite(height) && height > 0);
}


/* =========================================
   SHOW VIDEO INFORMATION
========================================= */

function showVideoInfo(data) {

    currentVideoInfo = data;

    if (downloadResult) {
        downloadResult.style.display = "block";
    }

    if (videoTitle) {

        videoTitle.textContent =
            data.title || "Video ready to download";
    }

    if (videoThumbnail) {

        if (data.thumbnail) {

            videoThumbnail.src = data.thumbnail;
            videoThumbnail.style.display = "block";

            if (thumbnailPlaceholder) {
                thumbnailPlaceholder.style.display = "none";
            }

        } else {

            videoThumbnail.style.display = "none";

            if (thumbnailPlaceholder) {
                thumbnailPlaceholder.style.display = "flex";
            }
        }
    }

    updateQualityButtons(data);
}


/* =========================================
   UPDATE QUALITY BUTTONS
========================================= */

function updateQualityButtons(data) {

    const qualityButtons = document.querySelectorAll(
        ".quality-download"
    );

    const availableQualities = getAvailableQualities(data);

    qualityButtons.forEach(button => {

        const format = (
            button.dataset.format || "mp4"
        ).toLowerCase();

        const quality = button.dataset.quality || "";

        button.classList.remove(
            "available",
            "unavailable"
        );

        button.disabled = false;

        if (format === "mp3") {

            if (data.mp3 === false) {

                button.textContent = "Audio not available";
                button.classList.add("unavailable");
                button.disabled = true;

            } else {

                button.textContent = "Download";
                button.classList.add("available");
            }

            return;
        }

        const requestedHeight = Number(
            normalizeQuality(quality)
        );

        const isAvailable =
            availableQualities.includes(requestedHeight);

        if (isAvailable) {

            button.textContent = "Download";
            button.classList.add("available");
            button.disabled = false;

        } else {

            button.textContent =
                "This video is not of this quality";

            button.classList.add("unavailable");
            button.disabled = true;
        }
    });


    const highestQuality = Math.max(
        0,
        ...availableQualities
    );

    if (maxDownloadBtn) {

        if (highestQuality > 0) {

            maxDownloadBtn.disabled = false;
            maxDownloadBtn.textContent = "Download";

        } else {

            maxDownloadBtn.disabled = true;
            maxDownloadBtn.textContent = "Not available";
        }
    }
}


/* =========================================
   PREPARE VIDEO
========================================= */

async function prepareVideo() {

    const url = videoUrl
        ? videoUrl.value.trim()
        : "";

    if (!url) {

        showDownloadPopup(
            "Enter video link",
            "Please paste a video URL first",
            "error"
        );

        return;
    }

    if (isLoading) return;

    isLoading = true;

    setDownloadButtonLoading(downloadBtn, true);

    setStatus(
        "Getting video information...",
        "loading"
    );

    showDownloadPopup(
        "Preparing video",
        "Checking available video qualities...",
        "loading"
    );

    try {

        const data = await getVideoInfo(url);

        showVideoInfo(data);

        setStatus("Video ready");

        showDownloadPopup(
            "Video ready",
            "Available qualities are shown below",
            "success"
        );

    } catch (error) {

        console.error("Video info error:", error);

        currentVideoInfo = null;

        if (downloadResult) {
            downloadResult.style.display = "none";
        }

        setStatus(
            "Unable to get video information",
            "error"
        );

        showDownloadPopup(
            "Unable to get video",
            error.message,
            "error"
        );

    } finally {

        setDownloadButtonLoading(downloadBtn, false);

        isLoading = false;
    }
}


/* =========================================
   DOWNLOAD FILE
========================================= */

function downloadFile(url, format, quality, button) {

    if (!url) {

        showDownloadPopup(
            "Missing video link",
            "Please paste a video URL",
            "error"
        );

        return;
    }

    if (button && button.disabled) return;

    const downloadUrl =
        `${API_BASE}/api/download` +
        `?url=${encodeURIComponent(url)}` +
        `&format=${encodeURIComponent(format)}` +
        `&quality=${encodeURIComponent(quality)}`;

    setDownloadButtonLoading(button, true);

    setStatus(
        "Preparing download...",
        "loading"
    );

    showDownloadPopup(
        "Preparing download",
        "Please wait a few seconds...",
        "loading"
    );

    const link = document.createElement("a");

    link.href = downloadUrl;
    link.style.display = "none";

    document.body.appendChild(link);

    link.click();

    setTimeout(() => {
        link.remove();
    }, 1500);

    setTimeout(() => {

        showDownloadPopup(
            "Download requested",
            "Check your phone's Downloads folder",
            "success"
        );

        setStatus("Download requested");

        setDownloadButtonLoading(button, false);

    }, 3000);
}


/* =========================================
   SUGGEST DOWNLOAD
   AUTOMATIC HIGHEST QUALITY
========================================= */

async function suggestedDownload() {

    const url = videoUrl
        ? videoUrl.value.trim()
        : "";

    if (!url) {

        showDownloadPopup(
            "Enter video link",
            "Please paste a video URL first",
            "error"
        );

        return;
    }

    if (maxDownloadBtn && maxDownloadBtn.disabled) {
        return;
    }

    try {

        let data = currentVideoInfo;

        if (!data) {

            showDownloadPopup(
                "Checking video",
                "Finding the highest available quality...",
                "loading"
            );

            setDownloadButtonLoading(
                maxDownloadBtn,
                true
            );

            data = await getVideoInfo(url);

            currentVideoInfo = data;

            showVideoInfo(data);

            setDownloadButtonLoading(
                maxDownloadBtn,
                false
            );
        }

        const availableQualities =
            getAvailableQualities(data);

        if (availableQualities.length === 0) {

            showDownloadPopup(
                "No video quality found",
                "This video has no available MP4 quality",
                "error"
            );

            return;
        }

        const highestQuality = Math.max(
            ...availableQualities
        );

        downloadFile(
            url,
            "mp4",
            `${highestQuality}p`,
            maxDownloadBtn
        );

    } catch (error) {

        console.error("Suggested download error:", error);

        setDownloadButtonLoading(
            maxDownloadBtn,
            false
        );

        showDownloadPopup(
            "Download failed",
            error.message,
            "error"
        );
    }
}


/* =========================================
   MAIN DOWNLOAD BUTTON
========================================= */

if (downloadBtn) {

    downloadBtn.addEventListener("click", () => {
        prepareVideo();
    });

}


/* =========================================
   QUALITY DOWNLOAD BUTTONS
========================================= */

document.querySelectorAll(".quality-download").forEach(button => {

    button.addEventListener("click", () => {

        if (button.disabled) return;

        const url = videoUrl
            ? videoUrl.value.trim()
            : "";

        const format = (
            button.dataset.format || "mp4"
        ).toLowerCase();

        const quality = (
            button.dataset.quality || ""
        ).toString();

        if (!url) {

            showDownloadPopup(
                "Enter video link",
                "Paste a video URL first",
                "error"
            );

            return;
        }

        if (!currentVideoInfo) {

            showDownloadPopup(
                "Check video first",
                "Press the main Download button first",
                "error"
            );

            return;
        }

        if (format === "mp4") {

            const available =
                getAvailableQualities(currentVideoInfo);

            const requestedHeight = Number(
                normalizeQuality(quality)
            );

            if (!available.includes(requestedHeight)) {

                showDownloadPopup(
                    "Quality unavailable",
                    "This video is not of this quality",
                    "error"
                );

                return;
            }
        }

        if (
            format === "mp3" &&
            currentVideoInfo.mp3 === false
        ) {

            showDownloadPopup(
                "Audio unavailable",
                "This video does not have audio",
                "error"
            );

            return;
        }

        downloadFile(
            url,
            format,
            quality,
            button
        );

    });

});


/* =========================================
   SUGGEST DOWNLOAD BUTTON
========================================= */

if (maxDownloadBtn) {

    maxDownloadBtn.addEventListener(
        "click",
        suggestedDownload
    );

}


/* =========================================
   CLEAR BUTTON
========================================= */

if (clearBtn) {

    clearBtn.addEventListener("click", () => {

        if (videoUrl) {
            videoUrl.value = "";
        }

        currentVideoInfo = null;

        if (downloadResult) {
            downloadResult.style.display = "none";
        }

        if (videoTitle) {
            videoTitle.textContent = "";
        }

        if (videoThumbnail) {
            videoThumbnail.src = "";
            videoThumbnail.style.display = "none";
        }

        if (thumbnailPlaceholder) {
            thumbnailPlaceholder.style.display = "flex";
        }

        if (maxDownloadBtn) {
            maxDownloadBtn.disabled = false;
            maxDownloadBtn.textContent = "Download";
        }

        setStatus("Ready");

        showDownloadPopup(
            "Cleared",
            "You can paste another video link",
            "success"
        );

    });

}


/* =========================================
   ENTER KEY
========================================= */

if (videoUrl) {

    videoUrl.addEventListener("keydown", event => {

        if (event.key === "Enter") {

            event.preventDefault();

            prepareVideo();
        }

    });

}


/* =========================================
   BACKEND STATUS CHECK
========================================= */

async function checkBackend() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);

        if (!response.ok) {
            throw new Error("Backend not responding");
        }

        const data = await response.json();

        if (data.success) {
            console.log("Backend connected successfully");
        } else {
            console.log("Backend connection failed");
        }

    } catch (error) {
        console.error("Backend Error:", error.message);
    }
}

checkBackend();