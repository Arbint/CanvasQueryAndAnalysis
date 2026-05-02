# Aggregation Node Graph

This is a node graph that is similar to Unreal Engine blueprint.

* Hit the tab button will allow the user to search and make nodes in the node graph, the node will be create under the cursor

* Have basic node management operations, marquee selection, shift to add select, ctrl to deselect. delete button to delete.

* Node can have input data pin(s) and output data pin(s). Some node does not have input data pin. User can drag and connect pins, if a pin has a connect already, dragging another connect on it will disconnect the existing pin.

 there are 2 type of nodes: 

    * Course nodes, they represent each of the course, they contain:
        * A Drop down list to select which course to reference.
        * 1 output data pin, which out puts the list of students.
        * has no input data pin.

    * Aggregation Nodes:
        * Union:
            * Defaults to have 2 input pins, each takes in a list of students
            * have a + button to add addtional inputs, alt click on an input pin to remove it.
            * a output pin to output the list of students that is the union of all the input student lists.

        * Intersect:
            * Same pins as the Union
            * the output pin outputs the list of student that is the intersection of all the input student lists.

        * Substract:
            * a from pin, that takes in a student list 
            * a subtrack data pin that takes in a student list
            * a + button to allow adding more subtract pins
            * a output pin that out puts the list of student that is the list of student connected to the from pin subtract all other subtract data pins.

Double clicking on a node will trigger the student list to show list of students the node is outputting
