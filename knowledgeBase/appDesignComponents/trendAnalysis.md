# Trend Analysis 

The trend analysis is a tool for the user to create a graph that shows the student count change over a sequence of courses.

It is broken down to a top and bottom section:

* The bottom section is called the courses section, in this section:
    The user can click on a + button to add a course column, the column will allow the user to pick a course, similar to the drop down search menu the course node has.

    once the course is picked, the column shows: 
        * number of student
        * the student list, and for each student, display their grade.
        * the day and time the course is offered
        * the instructor of the course

    the user can add as many column as they want.

* The top section is called the graph section, it draws a 2D graph with each course in the course section being a dot representing the number of students the course has, the vertial axis is the student cout axis, and the horizontal axis is aligned with the courses seciton, it has the following features.

    * Zoom in and out
    * Auto fit the graph
    * hover the cursor on the dot will show a popup displaying:
        * students reserved from the previous course column.
        * students lost from the previous course column.
        * new student that does not exist in the previous course column.

    * right click on the dot will give a context menu that allows the user to:
        * download a .csv of student reserved.
        * copy emails of student reserved.
        * download a .csv of student lost.
        * copy emails of student lost.
        * download a .csv of new students.
        * copy emails of new students.
