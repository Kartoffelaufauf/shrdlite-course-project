# High-level description of our implementation
Here are high-level descriptions of the three main components of the project.

## A* search algorithm
The algorithm is implemented using a priority queue, in which we store custom queue elements that in turn store a node and the various cost values associated with that particular node (e.i. g and f costs) as well as a reference to a parent node (e.i. another custom queue element). This, in the end, results in a linked list which we walk through to get the final path from the start node to the goal node.

## Interpreter
The interpreter implementation (excluding the extensions, explained in more detail in another section) is pretty straight forward. The "magic" happens in the inner functions *getEntities* and *isValid*. The function *getEntities* returns all entities in the world that fulfill a specific condition and is implemented recursively to be able to handle more complex conditions. The function *isValid* returns whether or not a specific relation is valid between two entities, making sure the interpretations returned by the interpreter is indeed valid.

## Planner
The implementation of the planner mainly consists of searching, using the function *aStarSearch*, for a state that fulfills the user's request. The way we did this is by first creating the new class *PlannerGraph* which has the function *outgoingEdges*. The function *outgoingEdges* returns, given a *PlannerNode*, all *valid* states that the state can transform into.

The class *PlannerNode* is a new class that functions as a wrapper for a world state.

Also, the search requires a *goal function*, which we named *goal*. It takes a *PlannerNode* and returns whether the embedded world state of the node fulfills all the conditions in *any* of the interpretations.

Then we have the *heuristics function*, which we named *heuristics*. It takes a *PlannerNode* and returns the *lowest* approximate cost of reaching *any* of the valid world goal states, from the world state embedded in the *PlannerNode*. The calculations are pretty complicated and take, among other things, the stack heights into account.

## Files changed
* Graph.ts
* Interpreter.ts
* Planner.ts
* grammar.ne

# Implemented extensions
Here is a list as well as descriptions of the extensions that we have implemented in the project.

## Be able to handle all quantifiers in a sensible manner
This extension makes it possible to use the *all* quantifier, e.g. *"move all balls left of a brick"*.

We implemented this by, in the interpreter, concatenating the list of possible interpretations in those cases where the *all* quantifier is used. We do this using the function *allQuantifierValidator*, as those relations need a bit more calculations.

In the function *allQuantifierValidator*, the possible interpretations are grouped by the first entity, from which we then calculate the cartesian product. From the list of those cartesian products we then filter out the ones that are incorrect.

## Make the planner describe what it is doing, in a way that is understandable to humans
This extension has the planner describe what it is doing, in a way that is understandable to humans, e.g. *"Picking up the blue box"*.

We implemented this by having the *PlannerNode* class have an optional *comment* property. We set this property whenever we reach a new state by either *dropping* or *picking up* an entity. The description is developed inside the function *getDescription* and is as unique for an entity as possible. Then when we create the final path we also output the comment property, if such a property exists in the state.

## New linguistic structures to the grammar: user questions (e.g., "where is the white ball?")
This extension makes it possible to have the program describe the positions of the entities matched by a set of conditions.

This is made possible by extending the grammar with a new *where is* command which in the interpreter is interpreted as just returning a list of the entities matched by the conditions. This list is then iterated over in the planner which in turn returns the positions of the entities in a way that is understandable to humans, naming which stack and *describing the entity which it is on top/inside of* just enough to have them be unique in that very stack. If the entity is not unique in the stack, it describes which one of them using an enumeration. This description is developed inside the function *getDescription*.

## More fine-grained cost calculation, taking the height of the stacks into account
We believe that we have a pretty good heuristics, with a good balance between accuracy and speed - and it does indeed take the height of the stacks into account.

## Deep world manipulation to fulfill user request
This extension makes it possible to ask the program to e.g. *"move a ball inside a box on the floor"* even if there isn't a *ball inside a box* nor a *box on the floor* at the moment.

This is made possible by, sort of, breaking the query into two parts, in this case, *move a ball inside* and *a box on the floor*. The second part is then sent recursively to *interpretCommand* as *move a box on the floor* which returns a list of possible interpretations, which we then extend with the relation *inside* between the ball and the box on the floor in the interpretations returned.

These requests can be made pretty long and complicated, as *"move the white ball inside a yellow box on a yellow brick on a red plank"* in the starting state of the world *complex*.

The exception is the *the* quantifier, where we interpret it as the entity matching the condition must already exist, and may not be created.

## Custom command to drop the entity currently held by the claw
This extension makes it possible to have the program drop the entity currently held by the claw.

This is made possible by extending the grammar with a new *drop it* command which in the interpreter is interpreted as having the entity currently held by the claw moved *above the floor*.
