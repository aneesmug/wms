// public/js/translations.js

document.addEventListener('DOMContentLoaded', () => {
    let translationsTable;

    const initializeDataTable = () => {
        translationsTable = $('#translationsTable').DataTable({
            ajax: {
                url: 'api/translations_api.php',
                dataSrc: 'data'
            },
            columns: [
                { data: 'lang_key' },
                { data: 'en', className: 'editable' },
                { data: 'ar', className: 'editable rtl-input' },
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-end',
                    render: function (data, type, row) {
                        return `<button class="btn btn-sm btn-outline-danger delete-btn" data-key="${row.lang_key}"><i class="bi bi-trash"></i> ${__('delete')}</button>`;
                    }
                }
            ],
            responsive: true,
            "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
            language: { // Added localization for datatables
                search: `<span>${__('search')}:</span> _INPUT_`,
                searchPlaceholder: `${__('search')}...`,
                lengthMenu: `${__('show')} _MENU_ ${__('entries')}`,
                info: `${__('showing')} _START_ ${__('to')} _END_ ${__('of')} _TOTAL_ ${__('entries')}`,
                infoEmpty: `${__('showing')} 0 ${__('to')} 0 ${__('of')} 0 ${__('entries')}`,
                infoFiltered: `(${__('filtered_from')} _MAX_ ${__('total_entries')})`,
                paginate: {
                    first: __('first'),
                    last: __('last'),
                    next: __('next'),
                    previous: __('previous')
                },
                emptyTable: __('no_data_available_in_table'),
                zeroRecords: __('no_matching_records_found')
            }
        });
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const result = await fetchData('api/translations_api.php?action=create', 'POST', data);
        if (result.success) {
            showMessageBox(result.message, 'success');
            form.reset();
            translationsTable.ajax.reload();
        } else {
            showMessageBox(result.message, 'error');
        }
    };

    const makeCellEditable = (cell) => {
        const originalContent = $(cell).text();
        const isRtl = $(cell).hasClass('rtl-input');
        const input = $(`<input type="text" class="form-control form-control-sm" value="${originalContent}">`);
        if (isRtl) {
            input.attr('dir', 'rtl');
        }
        $(cell).html(input);
        input.focus();

        input.on('blur', async () => {
            const newContent = input.val();
            if (newContent !== originalContent) {
                const row = translationsTable.row($(cell).closest('tr'));
                const rowData = row.data();
                const column = translationsTable.column($(cell));
                // This logic is a bit weak, relying on header text. A better way would be column name from config.
                const columnName = $(column.header()).html().toLowerCase() === __('english').toLowerCase() ? 'en' : 'ar';
                
                rowData[columnName] = newContent;

                const result = await fetchData('api/translations_api.php', 'PUT', rowData);
                if (result.success) {
                    showMessageBox(result.message, 'success');
                    $(cell).text(newContent);
                } else {
                    showMessageBox(result.message, 'error');
                    $(cell).text(originalContent); // Revert on failure
                }
            } else {
                $(cell).text(originalContent);
            }
        });

        input.on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                input.blur();
            }
        });
    };

    const handleDeleteClick = (event) => {
        const button = event.currentTarget;
        const langKey = button.dataset.key;

        showConfirmationModal(
            __('confirm_deletion'),
            `${__('are_you_sure_delete_key')} <strong>${langKey}</strong>?`,
            async () => {
                const result = await fetchData('api/translations_api.php', 'DELETE', { lang_key: langKey });
                if (result.success) {
                    showMessageBox(result.message, 'success');
                    translationsTable.row($(button).closest('tr')).remove().draw();
                } else {
                    showMessageBox(result.message, 'error');
                }
            }
        );
    };

    // --- Event Listeners ---
    $('#addTranslationForm').on('submit', handleFormSubmit);

    $('#translationsTable tbody').on('click', 'td.editable', function () {
        if ($(this).find('input').length === 0) {
            makeCellEditable(this);
        }
    });

    $('#translationsTable tbody').on('click', '.delete-btn', handleDeleteClick);


    // --- Initialization ---
    initializeDataTable();
});
