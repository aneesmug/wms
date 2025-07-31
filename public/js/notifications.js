/**
 * js/notifications.js
 * A centralized notification system using SweetAlert2 to ensure a consistent look and feel across the application.
 * This file provides standard functions for showing success messages, errors, confirmation dialogs, and toasts.
 */

/**
 * Displays a success notification popup.
 * @param {string} title - The title of the popup (e.g., 'Success!').
 * @param {string} text - The main message text of the popup.
 * @param {function} [callback] - Optional function to execute after the user clicks 'OK'.
 */
function showSuccess(title, text, callback) {
    Swal.fire({
        icon: 'success',
        title: title,
        text: text,
        confirmButtonColor: '#3085d6'
    }).then((result) => {
        if (result.isConfirmed) {
            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

/**
 * Displays an error notification popup.
 * @param {string} title - The title of the popup (e.g., 'Error!').
 * @param {string} text - The main message text of the popup.
 */
function showError(title, text) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        confirmButtonColor: '#d33'
    });
}

/**
 * Displays a confirmation dialog with 'Yes' and 'Cancel' buttons.
 * Useful for actions that require user confirmation, like deletions.
 * @param {string} title - The title of the dialog (e.g., 'Are you sure?').
 * @param {string} text - The main message text of the dialog.
 * @param {function} callback - The function to execute if the user clicks 'Yes'.
 */
function showConfirm(title, text, callback) {
    Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, do it!'
    }).then((result) => {
        if (result.isConfirmed) {
            // Execute the callback function if confirmation is received
            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

/**
 * Displays a small, temporary toast notification at the top-right of the screen.
 * Ideal for non-critical feedback, like 'Saved successfully'.
 * @param {string} icon - The icon for the toast ('success', 'error', 'warning', 'info').
 * @param {string} title - The title of the toast message.
 */
function showToast(icon, title) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    Toast.fire({
        icon: icon,
        title: title
    });
}
