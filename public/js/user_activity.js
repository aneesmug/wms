/*
* MODIFICATION SUMMARY:
* 1. Removed the `getGeoData` function and the associated IP cache. The frontend no longer performs geolocation lookups.
* 2. The `loadActivityData` function is now simpler. It directly uses the latitude, longitude, city, and country data provided by the API.
* 3. This makes the frontend faster, more reliable, and less complex.
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
                { data: 'full_name', title: 'User' },
                { data: 'username', title: 'Username' },
                { 
                    data: 'login_time', 
                    title: 'Login Time',
                    render: data => new Date(data).toLocaleString()
                },
                { data: 'ip_address', title: 'IP Address' },
                { data: 'city', title: 'City' },
                { data: 'country', title: 'Country' },
                { data: 'user_agent', title: 'User Agent' }
            ],
            order: [[2, 'desc']]
        });
    };

    // --- Load and Process Activity Data ---
    const loadActivityData = async () => {
        const result = await fetchData('api/users_api.php?action=get_user_login_activity');
        if (result && result.success) {
            const activities = result.data;
            const uniqueLocations = new Map();

            activities.forEach(activity => {
                // Group users by location for map markers
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

            // Add all data to the table
            activityTable.clear().rows.add(activities).draw();

            // Add grouped markers to the map
            plotMarkersOnMap(uniqueLocations);
        } else {
            showMessageBox('Failed to load user activity.', 'error');
        }
    };

    // --- Plot Markers on the Map ---
    const plotMarkersOnMap = (locations) => {
        locations.forEach(loc => {
            const marker = L.marker([loc.geo.lat, loc.geo.lng]).addTo(activityMap);
            const popupContent = `
                <b>Location:</b> ${loc.geo.city || 'N/A'}, ${loc.geo.country || 'N/A'}<br>
                <hr class="my-1">
                <b>Recent Logins:</b><br>
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
