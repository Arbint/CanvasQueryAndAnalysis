First Add an output node in the aggregation graph, this node has one input, and it shows the student list of it's input, an aggregation graph should have exactly 1 output node.

for the Trend Analysis, add another card type called Aggregation Graph, because there are some many types now, make it a drop down instead of button toggles.

The aggregation Graph has Label, term, and Department, just as the others. and it has a drop down after these to allow the user to pick existing aggregation graph created, or create a new one:

# New One:

When new is clicked, a pop up editor show up, that contains:

* A name field for the user to give the aggregation graph

* A node editor just like the Aggregation Graph, allowing the user to create nodes just like the aggregation graph, and the student list of the card should be what ever that connects to the output node in the graph.

* A save button allowing the user to save the graph after editing it.

* A cancel button to discard the change.

A saved aggregation graph should be saved to the data base so the user can pick it in the future.

# Existing One:

a list of existing ones for the user to pick from. for each existing ones, also add edit, and duplicate button. both would pop up the editor for the user to change the existing one or add a copy.

Finally, there should be also an edit button on the card to allow the user to edit the current one picked.

You may need to adjust the saving and loading system to support saving and loading for this too.

