const APP_VERSION = '2.0.8';

document.addEventListener('DOMContentLoaded', () => {
    let deferredPrompt;
    const scheduleContainer = document.getElementById('schedule-container');
    const currentEventDiv = document.getElementById('current-event');
    const nextEventDiv = document.getElementById('next-event');
    const currentTimeDiv = document.getElementById('current-time');
    const countdownDiv = document.getElementById('countdown-to-event');
    const installButton = document.getElementById('install-app-button');
    const reloadButton = document.getElementById('reload-button');
    const versionDisplay = document.getElementById('app-version-display');

    let scheduleData = []; // To store the fetched schedule

    // Add listeners when the DOM content is fully loaded
    window.addEventListener('DOMContentLoaded', () => {
        // --- Listen for beforeinstallprompt event ---
        // This event fires when the browser thinks the PWA is installable.
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile automatically
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            // Show our custom install button (make it visible)
            installButton.style.display = 'block';
            console.log('beforeinstallprompt fired: Install button shown.');
        });

        // --- Add click listener to our custom install button ---
        installButton.addEventListener('click', async () => {
            // Hide the button immediately after user interaction
            installButton.style.display = 'none';

            // Check if the prompt has been stored
            if (deferredPrompt) {
                // Show the native install prompt to the user
                deferredPrompt.prompt();

                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;

                // Log the user's choice for debugging/analytics
                console.log(`User response to the install prompt: ${outcome}`);

                // The prompt can only be used once, so clear it
                deferredPrompt = null;
            }
        });

        // --- Listen for the appinstalled event ---
        // This event fires if the PWA is installed by any means (e.g., via our button, or browser's own menu)
        window.addEventListener('appinstalled', () => {
            // Hide the install button immediately after successful installation
            installButton.style.display = 'none';
            console.log('PWA was successfully installed.');
        });

        // You can also add a check on load if the app is already installed
        // This is more reliable for app re-opens.
        if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
            console.log('App is running in standalone mode (already installed).');
            installButton.style.display = 'none'; // Hide button if already installed
        }

        if (reloadButton) { // Ensure the button exists before adding listener
            reloadButton.addEventListener('click', () => {
                console.log('Reload button clicked. Reloading page...');
                window.location.reload(); // This reloads the current page
            });
        }

        
    if (versionDisplay) {
        versionDisplay.textContent = `Version: ${APP_VERSION}`;
    }
    });

    
    // --- Helper Functions ---

    // Format time for display (e.g., 08:00)
    function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }

    // Format date for display (e.g., 8 ביולי 2025)
    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Create an event card HTML element
    function createEventCard(event) {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.eventId = event.id; // Store event ID for easy lookup

        // Check if event has ended or is upcoming
        const now = new Date();
        const endTime = new Date(event.endTime);
        const startTime = new Date(event.startTime);

        if (now > endTime) {
            card.classList.add('past'); // Style past events differently
        } else if (now >= startTime && now <= endTime) {
            card.classList.add('current'); // Style current event
        }

        // Generate HTML for multiple links
        let linksHtml = '';
        if (event.links && Array.isArray(event.links) && event.links.length > 0) {
            linksHtml = '<p><strong>קישורים נוספים:</strong></p><ul>';
            event.links.forEach(link => {
                if (link.text && link.url) {
                    linksHtml += `<li><a href="${link.url}" target="_blank">${link.text}</a></li>`;
                }
            });
            linksHtml += '</ul>';
        }

        // Generate HTML for description (now handles array or string)
        let descriptionHtml = '';
        if (event.description) {
            if (Array.isArray(event.description)) {
                if (event.description.length > 0) {
                    descriptionHtml = '<p><strong>תיאור:</strong></p><ul>';
                    event.description.forEach(item => {
                        descriptionHtml += `<li>${item}</li>`;
                    });
                    descriptionHtml += '</ul>';
                }
            } else { // Assume it's a single string
                descriptionHtml = `<p><strong>תיאור:</strong> ${event.description}</p>`;
            }
        }

        // Determine if there are any additional details to show
        // Now checks for event.description (if array, if not empty), notes, mapLink, or links array
        const hasDetails = (Array.isArray(event.description) && event.description.length > 0) || // If description is a non-empty array
            (!Array.isArray(event.description) && event.description) ||             // If description is a non-empty string
            event.notes || event.mapLink || (event.links && event.links.length > 0);


        card.innerHTML = `
            <div class="event-time">${formatTime(event.startTime)} - ${formatTime(event.endTime)}</div>
            <div class="event-title">${event.title}</div>
            ${event.location ? `<div class="event-location">מיקום: ${event.location}</div>` : ''}
            ${hasDetails ? `
                <button class="event-details-toggle">הצג פרטים נוספים</button>
                <div class="event-details-content">
                    ${descriptionHtml} 
                    ${event.notes ? `<p><strong>הערות:</strong> ${event.notes}</p>` : ''}
                    ${event.mapLink ? `<p><a href="${event.mapLink}" target="_blank">פתח במפה</a></p>` : ''}
                    ${linksHtml}
                </div>
            ` : ''}
        `;

        // Only add event listener if the toggle button exists
        if (hasDetails) {
            const toggleButton = card.querySelector('.event-details-toggle');
            const detailsContent = card.querySelector('.event-details-content');

            toggleButton.addEventListener('click', () => {
                const isHidden = detailsContent.style.display === 'none' || detailsContent.style.display === '';
                detailsContent.style.display = isHidden ? 'block' : 'none';
                toggleButton.textContent = isHidden ? 'הסתר פרטים' : 'הצג פרטים נוספים';
            });
        }

        return card;
    }

    // Display the full schedule
    function displayFullSchedule(schedule) {
        scheduleContainer.innerHTML = ''; // Clear previous content
        let currentDay = '';

        schedule.forEach(event => {
            const eventDate = formatDate(event.startTime);
            if (eventDate !== currentDay) {
                const dayHeader = document.createElement('h3');
                dayHeader.textContent = eventDate;
                scheduleContainer.appendChild(dayHeader);
                currentDay = eventDate;
            }
            scheduleContainer.appendChild(createEventCard(event));
        });
    }

    // Display "Now & Next" events
    function updateNowAndNext() {
        try {


            const now = new Date();
            // Filter out past events
            const upcomingEvents = scheduleData.filter(event => new Date(event.endTime) > now);

            // Sort events by start time
            upcomingEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            const currentEvent = upcomingEvents.find(event => now >= new Date(event.startTime) && now <= new Date(event.endTime));
            const nextEvent = upcomingEvents.find(event => new Date(event.startTime) > now && (currentEvent ? new Date(event.startTime) > new Date(currentEvent.endTime) : true)); // Find next event after current or from now

            // --- Crucial Change Here: Clear the existing content before adding new ---
            // This ensures a clean slate and avoids appending to old elements.
            currentEventDiv.innerHTML = '';
            nextEventDiv.innerHTML = '';

            if (currentEvent) {
                const currentEventCard = createEventCard(currentEvent); // Create the card with its listeners
                const currentTitle = document.createElement('h3'); // Create the title as a DOM element
                currentTitle.textContent = 'עכשיו:';
                currentEventDiv.appendChild(currentTitle);    // Append the title
                currentEventDiv.appendChild(currentEventCard); // Append the card (its listeners are preserved)
                currentEventDiv.classList.add('current'); // Add current class to the main div
            } else {
                currentEventDiv.innerHTML = `<p>אין פעילות כרגע.</p>`;
                currentEventDiv.classList.remove('current'); // Ensure current class is removed if no event
            }

            if (nextEvent) {
                const nextEventCard = createEventCard(nextEvent); // Create the card with its listeners
                const nextTitle = document.createElement('h3'); // Create the title as a DOM element
                nextTitle.textContent = 'הבא בתור:';
                nextEventDiv.appendChild(nextTitle);    // Append the title
                nextEventDiv.appendChild(nextEventCard); // Append the card (its listeners are preserved)
            } else {
                nextEventDiv.innerHTML = `<p>אין פעילויות קרובות.</p>`;
            }

            // --- UPDATED CODE FOR DATE FORMAT ---
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
            const year = now.getFullYear();

            const formattedDate = `${day}/${month}/${year}`; // Construct dd/MM/yyyy

            const formattedTime = now.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // Combine date and time
            currentTimeDiv.textContent = `${formattedDate}, ${formattedTime}`;
            // --- END UPDATED CODE ---

            let countdownMessage = '';
            if (nextEvent) {
                const timeDiffMs = new Date(nextEvent.startTime).getTime() - now.getTime();
                const totalMinutes = Math.floor(timeDiffMs / (1000 * 60)); // Get total minutes, rounded down

                if (totalMinutes > 0) {
                    const hours = Math.floor(totalMinutes / 60);
                    const remainingMinutes = totalMinutes % 60;

                    let timeParts = [];
                    if (hours > 0) {
                        timeParts.push(`${hours} שעות`);
                    }
                    if (remainingMinutes > 0) {
                        timeParts.push(`${remainingMinutes} דקות`);
                    }

                    if (timeParts.length > 0) {
                        countdownMessage = `נותרו ${timeParts.join(' ו-')} להתחלת: ${nextEvent.title}`;
                    } else {
                        // If totalMinutes was positive but hours and remainingMinutes are 0 (e.g., less than 1 minute)
                        countdownMessage = `פחות מדקה להתחלת: ${nextEvent.title}`;
                    }

                } else {
                    // If totalMinutes is 0 or negative, it means the 'nextEvent' is either starting now or just started
                    if (currentEvent && nextEvent.id === currentEvent.id) {
                        countdownMessage = `האירוע '${currentEvent.title}' מתרחש כעת.`;
                    } else {
                        countdownMessage = `האירוע הבא '${nextEvent.title}' מתחיל כעת.`;
                    }
                }
            } else if (currentEvent) {
                // No 'next' event, but a 'current' event is ongoing
                countdownMessage = `האירוע '${currentEvent.title}' מתרחש כעת.`;
            } else {
                countdownMessage = 'אין אירועים קרובים';
            }
            if (countdownDiv != null) {
                countdownDiv.textContent = countdownMessage;
            }
            // --- END UPDATED: Countdown ---
        } catch (error) {

        }
    }

    // --- Data Loading ---

    async function loadSchedule() {
       let data;
        try{
        try {
                
                const response = await fetch('schedule.json');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                data = await response.json();
       
                // Save timestamp
                const now = new Date();
                localStorage.setItem('scheduleLastUpdated', now.toISOString());
        
                console.log('Schedule saved to localStorage.');
        
            } catch (networkError) {
                console.warn('Fetch failed, trying localStorage...', networkError);
            }
            // Sort schedule by startTime
            scheduleData = data.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            displayFullSchedule(scheduleData);
            updateNowAndNext(); // Initial update for "Now & Next"
            setInterval(updateNowAndNext, 30000); // Update every 30 seconds
            const lastUpdatedDiv = document.getElementById('last-updated');
            const timestamp = localStorage.getItem('scheduleLastUpdated');
            if (timestamp && lastUpdatedDiv) {
                const date = new Date(timestamp);
                lastUpdatedDiv.textContent = `עודכן לאחרונה: ${date.toLocaleString('he-IL')}`;
            }
            
        } catch (error) {
            console.error('Could not load schedule:', error);
            scheduleContainer.innerHTML = '<p style="color: red;">שגיאה בטעינת הלו"ז. נסה לרענן את הדף או בדוק את חיבור האינטרנט.</p>';
            currentEventDiv.innerHTML = '<p style="color: red;">שגיאה בטעינת הלו"ז.</p>';
            nextEventDiv.innerHTML = '<p style="color: red;">שגיאה בטעינת הלו"ז.</p>';
        }
    }

    // --- Service Worker Registration ---

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }

    // Initial load
    loadSchedule();
});
