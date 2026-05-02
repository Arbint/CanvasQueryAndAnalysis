Add a new node type call course collection. this node allows the user to use filter to select multiple courses and the out put of the node is the union of all the coursed found by the filter.

The node should have the following filters:
* Term filter
* Code Filters:
    the course code is composed with the following parts:
    * Department Abreviation (ANGD)
    * course number (3362, 4140)
        the highest digit of the course number represent their year, a number of 1 means freshmean year, and a number of 2 mean sophomore, a number of 3 means junior year, and 4 means senior year. for example, 3362 means junior and 4140 means senior year.
    * Section (Section 01, Section 02)
    * Semester code (SP26, FA26)

    * the course code filters includes:
        * Department
        * course number filter, for this one, make it support wild card with *. for example, 3*** means all 3000 level coruses. 3*7* all 3000 levels that has the second digit being 7.

when a filter is empty, it means everything in that filter type.
    
The node should display all the courses it currently found as a list

