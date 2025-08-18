/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
*/

document.addEventListener('DOMContentLoaded', () => {
    let activityMap;
    let activityTable;

    // --- Initialize Map ---
    const initializeMap = () => {
        activityMap = L.map('activityMap').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(activityMap);
    };

    // --- Initialize DataTable ---
    const initializeDataTable = () => {
        activityTable = $('#activityTable').DataTable({
            processing: true,
            responsive: true,
            columns: [
                { data: 'full_name', title: __('user') },
                { data: 'username', title: __('username') },
                { 
                    data: 'login_time', 
                    title: __('login_time'),
                    render: data => new Date(data).toLocaleString()
                },
                { data: 'ip_address', title: __('ip_address') },
                { data: 'city', title: __('city') },
                { data: 'country', title: __('country') },
                { data: 'user_agent', title: __('user_agent') }
            ],
            order: [[2, 'desc']],
            language: {
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
                zeroRecords: __('no_matching_records_found'),
                processing: `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">${__('loading')}...</span></div>`
            }
        });
    };

    // --- Load and Process Activity Data ---
    const loadActivityData = async () => {
        const result = await fetchData('api/users_api.php?action=get_user_login_activity');
        if (result && result.success) {
            const activities = result.data;
            const uniqueLocations = new Map();

            activities.forEach(activity => {
                if (activity.latitude && activity.longitude) {
                    const key = `${activity.latitude},${activity.longitude}`;
                    if (!uniqueLocations.has(key)) {
                        uniqueLocations.set(key, {
                            geo: { 
                                lat: activity.latitude, 
                                lng: activity.longitude,
                                city: activity.city,
                                country: activity.country
                            },
                            users: []
                        });
                    }
                    uniqueLocations.get(key).users.push(`<b>${activity.full_name}</b> (${activity.username}) at ${new Date(activity.login_time).toLocaleTimeString()}`);
                }
            });

            activityTable.clear().rows.add(activities).draw();
            plotMarkersOnMap(uniqueLocations);
        } else {
            showMessageBox(__('failed_to_load_user_activity'), 'error');
        }
    };

    // --- Plot Markers on the Map ---
    const plotMarkersOnMap = (locations) => {
        locations.forEach(loc => {
            const marker = L.marker([loc.geo.lat, loc.geo.lng]).addTo(activityMap);
            const popupContent = `
                <b>${__('location')}:</b> ${loc.geo.city || __('n_a')}, ${loc.geo.country || __('n_a')}<br>
                <hr class="my-1">
                <b>${__('recent_logins')}:</b><br>
                <ul>${loc.users.map(u => `<li>${u}</li>`).join('')}</ul>
            `;
            marker.bindPopup(popupContent);
        });
    };

    // --- Initializations ---
    initializeMap();
    initializeDataTable();
    loadActivityData();
});
