async function loadData() {
    const year = document.getElementById('year').value;
    const term = document.getElementById('term').value;
    const subj = document.getElementById('subject').value;
    const selected_subject = subj == "None" ? null : subj
    console.log(selected_subject)
    

    const apiUrl = `https://coursesapi.langaracs.ca/semester/${year}/${term}/sections`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        const grid = document.getElementById('grid');
        grid.innerHTML = '';

        const days = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const timeSlots = [];
        let m = "am"
        for (let hour = 8; hour <= 21; hour++) {
            let fhour = hour
            if (fhour > 12){
                fhour-=12
                m = "pm"
            }
            timeSlots.push(`${fhour}:00 ${m} - ${fhour}:30 ${m} (${(hour-8)*2})`);
            timeSlots.push(`${fhour}:30 ${m} - ${fhour + 1}:00 ${m} (${(hour-8)*2 + 1})`);
        }

        // Create header row
        days.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'cell cell-header';
            cell.innerText = day;
            grid.appendChild(cell);
        });

        // Create time slots and initialize cells
        for (let i = 0; i < timeSlots.length; i++) {
            const timeCell = document.createElement('div');
            timeCell.className = 'cell time-cell';
            timeCell.innerText = timeSlots[i];
            grid.appendChild(timeCell);

            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.innerText = '0';
                grid.appendChild(cell);
            }
        }

        // Create a 5-day x 28-slot matrix to count sections
        const sectionCounts = Array.from({ length: 5 }, () => new Array(28).fill(0));

        // Aggregate counts of sections per time slot
        data.forEach(course => {
            course.schedule.forEach(schedule => {
                if (schedule.type == "Exam") {
                    return;
                }
                
                console.log(course.subject != selected_subject)
                if (selected_subject != null && course.subject != selected_subject) {
                    return
                }
                

                const days = schedule.days.split('');
                const startHour = parseInt(schedule.time.substring(0, 2));
                const startMinute = parseInt(schedule.time.substring(2, 4));
                const endHour = parseInt(schedule.time.substring(5, 7));
                const endMinute = parseInt(schedule.time.substring(7, 9));

                // Calculate start and end blocks (each block is a half-hour)
                const startBlock = ((startHour - 8) * 2) + (startMinute >= 30 ? 1 : 0);
                const endBlock = ((endHour - 8) * 2) + (endMinute > 30 ? 1 : 0);

                days.forEach((day, index) => {
                    if (day === 'M' || day === 'T' || day === 'W' || day === 'R' || day === 'F') {
                        const dayIndex = 'MTWRF'.indexOf(day);
                        for (let i = startBlock; i <= endBlock; i++) {
                            if (i >= 0 && i < 28) {
                                sectionCounts[dayIndex][i]++;
                            }

                            // if (day === 'T' && i == 21) {
                            //     alert(
                            //         JSON.stringify(course) + "\n\n" + JSON.stringify(schedule))
                            // }
                        }
                    }
                });
            });
        });

        // Find the maximum count for color scaling
        const maxCount = Math.max(...sectionCounts.flat());

        // Update grid cells with the aggregate count of sections and apply color coding
        sectionCounts.forEach((counts, dayIndex) => {
            counts.forEach((count, slotIndex) => {
                const cellIndex = ((slotIndex + 1) * 6) + dayIndex + 1; // +1 to account for the header row
                const cell = grid.children[cellIndex];
                if (cell) {
                    cell.innerText = count;
                    cell.className = `cell ${getColorClass(count, maxCount)}`;
                }
            });
        });
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function getColorClass(count, maxCount) {
    if (count === 0) return '';
    const ratio = count / maxCount;
    if (ratio < 0.15) return 'low-density';
    if (ratio < 0.3) return 'medium-low-density';
    if (ratio < 0.45) return 'medium-density';
    if (ratio < 0.6) return 'medium-high-density';
    if (ratio < 0.75) return 'high-density';
    if (ratio < 0.9) return 'very-high-density';
    return 'extreme-density';
}
