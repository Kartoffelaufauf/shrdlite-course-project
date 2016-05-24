# High-level description of our implementation
Here are high-level descriptions of the three main components of the project.

## A* search algorithm
The algorithm is implemented using a priority queue, in which we store custom queue elements that in turn store a node and the various cost values associated with that particular node (e.i. g and f costs) as well as a reference to a parent node (e.i. another custom queue element). This, in the end, results in a linked list which we walk through to get the final path from the start node to the goal node.

## Interpreter
The interpreter implementation is pretty straight forward (excluding the extensions, explained in more detail in another section). The "magic" happens in the inner functions *getEntities* and *isValid*. The function *getEntities* returns all entities in the world that fulfill a specific condition and is implemented recursively to be able to handle more complex conditions. The function *isValid* returns whether or not a specific relation is valid between two entities, making sure the interpretations returned by the interpreter is indeed valid.

## Planner
TODO

# Implemented extensions
Here is a list as well as descriptions of the extensions that we have implemented in the project.

## Be able to handle all quantifiers in a sensible manner
TODO

## Make the planner describe what it is doing, in a way that is understandable to humans
TODO

## New linguistic structures to the grammar: user questions (e.g., “where is the white ball?”)
This extension makes it possible to have the program describe the positions of the entities matched by a set of conditions.

This is made possible by extending the grammar with a new *"where is"* command which in the interpreter is interpreted as just returning a list of the entities matched by the conditions. This list is then iterated over in the planner which in turn returns the positions of the entities in a natural way, naming which stack and *describing the entity which it is on top/inside of* just enough to have them be unique in that very stack. If the entity is not unique in the stack, it describes which one of them using enumeration. This description is developed inside the function *getDescription*.

## More fine-grained cost calculation, taking the height of the stacks into account
We believe that we have a pretty good heuristics, with a good balance between accuracy and speed - and it does indeed take the height of the stacks into account.

## Deep world manipulation to fulfill user request
This extension makes it possible to ask the program to e.g. *"move a ball inside a box on the floor"* even if there isn't a *ball inside a box* nor a *box on the floor* at the moment.

This is made possible by, sort of, breaking the query into two parts, in this case, *move a ball inside* and *a box on the floor*. The second part is then sent recursively to *interpretCommand* as *move a box on the floor* which returns a list of possible interpretations, which we then extend with the relation *inside* between the ball and the box on the floor in the interpretations returned.

These requests can be made pretty long and complicated, as *"move the white ball inside a yellow box on a yellow brick on a red plank"* in the starting state of the world *complex*.

## Custom command to drop the entity currently held by the claw
This extension makes it possible to have the program drop the entity currently held by the claw.

This is made possible by extending the grammar with a new *"drop it"* command which in the interpreter is interpreted as having the entity currently held by the claw moved *above the floor*.
