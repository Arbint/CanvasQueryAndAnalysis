
For the course collection, let's alter the filtering method to a expression based filtering.

Instead of + Add include Filter and + Add Exlude Filter, lets just do a Set Filter. and when clicked, a drop down shows up, allowing the use to select an existing expression, or Create a new expression. for each existing expression, there should be an edit button, allowing the user to edit the expression. 

## Select Existing Ones
Use the selected existing filter expression as the filter.

## New and Edit
When picking creating a new expresison or editing existing ones a Popup window should show up, allowing you to edit it with the following controls:

* A name field for the filter

* An expression editor to define the filter:

A filter is an expression that is consist of:

    * course code patterns: should be written with a leading $, for example, $2*3* means a course code that has 2 as first digit, and 3 as thrid digit.

    * faculty keyword: should be written with a leading @, for example, @Jing find faculty with Jing in their name

    * semester keyword: should be written with a leading #, for example, #2025 means all terms in 2025, and #FA2025 means fall 2025, #SP2025 means spring 2025, and #SU2025 means summer 2025.

    * operators: should have python style boolean operators like and, or, not
 
    * the expression should also support () to dictate precedence.


 Filter examples:

The following expresssion should filter out course that are not having the course code pattern 2*3* or 2*6*.
```py
$2*3* or $2*6*
```

The following expresssion should show courses that follows the pattern **7* or **8* and must have the pattern 3***, taught by Jingtian Li, and is offered in 2025.
```py
($**7* or $**8*) and $3*** and @Jing and #2025
```

the expresion editor should provide syntax highlighting.

* A Save button to save the expression. 

## Control over the filter
Be sure there is also edit button on each of the filter already added to the filter bar, to allow user to edit the filter expression too with the same pop up window described above.

Besure the Course collection in the Aggregation graph and Trend Analysis works the same way.