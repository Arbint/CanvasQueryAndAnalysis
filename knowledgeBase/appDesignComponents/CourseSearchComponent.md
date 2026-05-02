# Course Search Component

## Overview 

The course search component is used for the user to search for courses with filters.

It has the following components:
### Account
this is a drop downlist for the user to select the available account under the canvas api token.

### Filter Settings

* The filter settings has the following components:

    * Semester Filter: allow multiple semester to be selected, and the search result should include all selected semesters, this should be similar to what JetBrain YouTrack does. when adding semesters to the filter, the user press the + button in the field, a search bar would apear, allowing the user to search for a semster, and hit enter to add that semester. there is always a + button after the selected semesters to add another semester filter. 

    * Keyword Filter: allow the user to put in keywords, the keywords are used to check against the name of the courses, and it will filter out any course that does not contain all the keywords put in here, keywords are added the same way as the semester filters.


    * Search button, when the button is clicked, the search should start, and when finished, list out the courses in the Coruse List.

    * Query student count button, when the button is clicked, it will show the student count for each course in the Course List.


### Course List

* Display the list of courses filtered by the filter settings after the Search button is clicked in the filter settings. For each course, show the following infomation:
    * Course Name
    * Course Number
    * Instructor
    * Semester they are in 
    * Student count, only populate when the Query student count button is pressed.

If the course list is too long, add a slider to the list.