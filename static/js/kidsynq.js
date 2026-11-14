/**
 * KidSynq SaaS Platform - Core Client-Side Utilities
 * Framework: Vanilla JavaScript (ES6) + Bootstrap 5 + Chart.js
 */

// CSRF Cookie Extraction Helper
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Copy to Clipboard with Visual Feedback
function copyToClipboard(text, buttonElement) {
    if (!navigator.clipboard) {
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
    } else {
        navigator.clipboard.writeText(text);
    }
    
    if (buttonElement) {
        const originalHtml = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="bi bi-check-circle-fill me-1 text-success"></i> Copied!';
        buttonElement.classList.add('border-success', 'text-success');
        setTimeout(() => {
            buttonElement.innerHTML = originalHtml;
            buttonElement.classList.remove('border-success', 'text-success');
        }, 2200);
    }
}

// Sidebar Mobile Toggle & Submenu Auto-Expand
document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.getElementById('appSidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function () {
            sidebar.classList.toggle('show');
            if (backdrop) backdrop.classList.toggle('show');
        });
    }

    if (backdrop && sidebar) {
        backdrop.addEventListener('click', function () {
            sidebar.classList.remove('show');
            backdrop.classList.remove('show');
        });
    }

    // Auto-open sidebar submenu if it contains the currently active link
    const activeSubLinks = document.querySelectorAll('.sidebar-submenu .sidebar-link.active');
    activeSubLinks.forEach(link => {
        const submenuCollapse = link.closest('.collapse');
        if (submenuCollapse) {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(submenuCollapse, { toggle: false });
            bsCollapse.show();
            const parentToggle = document.querySelector(`[data-bs-target="#${submenuCollapse.id}"]`);
            if (parentToggle) {
                parentToggle.setAttribute('aria-expanded', 'true');
            }
        }
    });

    // Initialize Bootstrap 5 Tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Auto-dismiss Flash Alerts after 5 seconds
    const autoDismissAlerts = document.querySelectorAll('.alert-dismissible:not(.alert-permanent)');
    autoDismissAlerts.forEach(function (alert) {
        setTimeout(function () {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            if (bsAlert) bsAlert.close();
        }, 5000);
    });
});

// Reusable Helper to Render Chart.js with KidSynq Modern Styling
function renderChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 16,
                    font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 12, weight: '600' }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { family: "'Outfit', sans-serif", size: 13, weight: '700' },
                bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
                padding: 12,
                cornerRadius: 8,
                boxPadding: 4
            }
        }
    };

    const mergedOptions = Object.assign({}, defaultOptions, options);
    return new Chart(canvas, {
        type: type,
        data: data,
        options: mergedOptions
    });
}
