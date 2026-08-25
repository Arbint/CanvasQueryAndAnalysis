For the Course Collection node in the Aggregation Graph.

Instead of using the course number as filter. Lets change it to two lists of course number filters:

* Include Filters List:

    * add an Add Include Filter button. 
    * When clicked, a course number filter will be added to the Include Filters List, and it behaves like the original course number filter, allowing wild card.

    * When the Add Include Fitler button is clicked again, another course number filter should be added to the Include Filters List. allowing the user to add another filter.

    * The result of the Include Filters List is the union of all the course filters in the list.

* Exclude Filters List:
    * add an Add Exclude Filter button.

    * When clicked, a course number filter will be added to the Exclude Filters List, and it behaves like the original course number filter, allowing wild card.

    * When the Add Include Fitler button is clicked again, another course number filter should be added to the Exclude Filters List. allowing the user to add another filter.

    * The result of the Exclude Filters List is the union of all the course filters in the list.


The final result of the course collection list is going to be:
(The result of the Include Filters LIst) - (the Result of the Exclude Filters List)