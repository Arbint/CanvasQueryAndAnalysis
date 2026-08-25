Add another tab called grade reporter next to the Student Course Audit tab.

This tab should have 2 columns:

* Filter Column

    * The Filter column allows the user to filter a collection of courses, it has the same behavior and UI elements of the Course Collection node in the Aggregation graph.

    * The Filter column should also have a Generate Report button, when clicked, it will generate grade report for each of the student in the list of courses and their grade in each of the course in the Grade Column.

* Grade Column
    * it is a table that has:
        * student as rows
        * courses as columns
        * grade for the student at a course as cells, the grade should be the grade appears in the Total column in the Gradebook on canvas. It should be in a form of a percent, like 71%. If a student is not in a class, or no grade has been given yet, the value of the grade would be a -.

    * on top of the table, add a grade range filter, defaults to 0% to 100%. The table will show only students with a the grade that is in the rage. a grade of - is always considered out of the range.







