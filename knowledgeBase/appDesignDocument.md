# Canvas Query And Analysis

------------------
## Overview:

this is a canvas course query application, it's primary purposes are: 
* query the courses through filters
* get student count on each course
* get infomation on each of the student in a list, their name, Login ID, SSID, and genereate their email based on their login ID  
* do set operations on the students of courses

this app does query only, it will not alter the data on Canvas, and it is stateless

this app uses the following system environment variables to get access to canvas:
* CANVAS_API_TOKEN
* CANVAS_API_URL

The app should be able to be launched easily, but for the development stage, do not use docker to containerize it.

The app has a unified theme, that is defined in a centralized place

----------------
## Backend
Backend should be done with python, under the assumption that future data analytics can be needed, and is better to use python.
What endpoints the backend will have will be determined by the frontend and the features requrested, see the Frontend section.

---------------
## Frontend
Front end should use the mornden solution that fits the task, the programmer (you), should propose a teck stack.

### Structure of the Frontend
The front end is primarily composed of 3 columns:

#### Course Search Column:

This is the place for the user to search for courses
It's structure is described in here: @/knowledgeBase/appDesignComponents/CourseSearchComponent.md

#### Course Aggregation Graph:

This is the place for the user to build a aggregation pipeline to get a list of student from varies courses found in the Course Search Component. 
It's structure is described in here: @/knowledgeBase/appDesignComponents/AggregationNodeGraph.md

#### Student List:

This is the column that desplays the list of the student generated from the course aggregation graph.
It's structure is described in here: @/knowledgeBase/appDesignComponents/StudentList.md

-----------------

## Extras
The app has an icon on the upper left coner, the icon is stored in: ./assets/uiw3d_Logo_PNG_White.png, use it also for the favicon.

