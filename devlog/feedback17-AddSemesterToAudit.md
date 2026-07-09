Let's change the behavior of Student Course Audit to this:

Broken down the page to 3 parts:

* Base info
    - same Student ID, and Name, but no Audit Button

* Summary
    * Total Hours, the credit hours of a course is embeded in the Course code, for example, if the course code is ANGD-2330 Section 01 FA26, it is 3 credit hours, and if the course is ANGD-4100 Section 01 FA26, it is 1 credit hour, the second number after the first '-' character is the number of the credit hour.

    * Hours per semester
        - this should be a table showing semester as rows, and one column for the credit hours.


* Semesters
    - This is a list of Semester Component:

        - The Semester Component has:a

            * a semester field for the user to search for a semester to confiure which semester this component is.

            * an Audit button, when click, will do the audit for the semester configured for the semester component.

            * A table that shows the resulting courses after the Audit button is clicked, it should be empty before the Audit button is clicked, the table should have the same rows and column layout as the current implmentation with the existing sorting capability as well. 
        
    - the user can click a + button at the bottom of the list to add a semester Component. 

    - At the top, add a Audit all button which will do auditing for all the semesters listed. 