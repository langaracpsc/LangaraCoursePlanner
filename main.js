var c

document.addEventListener('DOMContentLoaded', async function() {


  const db = new Database()

  db.fetchDB()
    .then(() => {
      c.parseFromDB()
      // Render calendar
      // Render courses
      c.courselistUpdate()
      c.reloadCourseList()

      //c.FCalendar.addResource(c.generateResources(), false)
    })
    .catch(error => {console.error(error);});

  c = new Calendar(db)
  console.log(c)



  var calendarElement = document.getElementById('calendar');

  var FCalendar = new FullCalendar.Calendar(calendarElement, {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
    rerenderDelay: 10,

    // resource stuff
    resourceGroupField: 'groupId',
    resourceGroupLabelContent: function(arg) {return timelineLabelApplier(arg.groupValue)},
    resources: function(fetchInfo, successCallback, failureCallback) {successCallback(c.generateResources())},
    resourceAreaWidth: "120px",
    // show class info when clicked
    //eventClick: function(eventClickInfo) {console.log(calendarClass.showCourseInfo(eventClickInfo.event.id))},

    // calendar stuff
    timeZone: 'America/Vancouver',
    initialView: 'timeGridWeek', // 'resourceTimelineDay'
    slotMinTime:"07:00", // classes start 7:30 and end 9:30
    slotMaxTime:"22:00",
    displayEventTime: false, // honestly not sure what this does
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
      //right: 'resourceTimelineDay,resourceTimelineWeek dayGridMonth,timeGridWeek,timeGridDay'
    },
    weekends: document.getElementById("weekendCheckbox").checked,
    //initialDate: new Date(new Date(calendarClass.courses_first_day).getTime() + 604800000), // start on the second week of courses
    slotEventOverlap:false,
    
    // fires when event is created, adds a second line of text to event because you can't by default ._.
    eventContent: function(info) {
      let p = document.createElement('p')
      p.innerHTML = info.event.extendedProps["description"]
      return { domNodes: [p] }
    },

  })
  FCalendar.eventTextColor = 'black'


  c.FCalendar = FCalendar

  // Render calendar
  FCalendar.render();

  // Render courses
  //c.courselistUpdate()


  // Set up event listeners for modifying the calendar.

  document.getElementById("weekendCheckbox").addEventListener("input", function (event) {
    FCalendar.setOption('weekends', event.target.checked)
    FCalendar.render()
  })

  // Color course element based on availability
  // bit of a misnomer of a comment
  document.getElementById("showColors").addEventListener("input", function (event) {
    if (document.getElementById("showColors").checked) {
      for (const e of document.getElementById("courselist").children )
        e.classList.remove("gray")
    } else {
      for (const e of document.getElementById("courselist").children )
        e.classList.add("gray")
    }
  })


  // show/hide courses on calendar when they are clicked on
  document.getElementById("courselist").addEventListener("click", function (event) {
    let target = event.target

    // open info about course if title is clicked
    if (target.nodeName == "H3") {
      c.showCourseInfo(event.target.parentElement.id)
    
    // else put it on the calendar
    } else if (target.nodeName != "DIV") {
      target = event.target.parentElement
    } 

    if (target.nodeName == 'DIV' && target.id == "") {
      target = target.parentElement
    }
    
    if (target.classList.contains("courselistcourse")) {
      c.toggleFCalendar(target.id)
      c.courselistUpdate()
    }

  })


  // ghosting functionality
  document.getElementById("courselist").addEventListener("mouseover", function (event) {

    let target = event.target

    if (target.nodeName != "DIV")
      target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "") 
      target = target.parentElement
      
    
    if (target.classList.contains("courselistcourse"))
    
    c.setGhostFCalendar(target.id)
  })

  // make sure ghosting stops when mouse leaves
  document.getElementById("courselist").addEventListener("mouseleave", function (event) {
    c.setGhostFCalendar(null)
  })

  // automatically update results when searching
  let debounceTimeout;
  document.getElementById("courseSearchBar").addEventListener("input", function (event) {
      if (c.courses_shown.length > 2000) {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(function() {
              c.courselistUpdate();
          }, 250); // 250 milliseconds (0.25 seconds) debounce delay
      } else {
          // Perform immediate update if the condition is not met
          c.courselistUpdate();
      }
  });



  // conflicting courses
  document.getElementById("conflictCheckbox").addEventListener("input", function (event) {
    c.courselistUpdate()
  })

  // toggle all
  let allCoursesShown = false
  document.getElementById("showAllCheckbox").addEventListener("click", function (event) {

    if (!allCoursesShown) {
      let state = FCalendar.getOption('weekends')
      
      FCalendar.setOption('weekends', true) // must toggle weekends for them to render properly idk why
      c.toggleAllFCalendar(true)
      FCalendar.setOption('weekends', state)
      event.target.value = "Hide all courses in list."
      

    } else {
      c.toggleAllFCalendar(false)
      event.target.value = "Show all courses in list."
    }

    allCoursesShown = !allCoursesShown
  })

  // TODO: redo this
  // populate termSelector and event handler for changing terms
  let ts = document.getElementById("termSelector")

  ts.addEventListener("input", async function (event) {
    //if (allCoursesShown)
    //  c.toggleAllFCalendar(false) // get rid of courses from previous term
    
    // set the current date to the first day of semester plus a week
    //c.newCourseDataLoaded()

    //if (allCoursesShown)
    //  c.toggleAllFCalendar(true) // continue showing all courses

    c.courselistUpdate()
  })

})