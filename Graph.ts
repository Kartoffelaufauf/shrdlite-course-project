///<reference path="lib/collections.ts"/>
///<reference path="lib/node.d.ts"/>

/** Graph module
*
*  Types for generic A\* implementation.
*
*  *NB.* The only part of this module
*  that you should change is the `aStarSearch` function. Everything
*  else should be used as-is.
*/

/** An edge in a graph. */
class Edge<Node> {
    from : Node;
    to   : Node;
    cost : number;
}

/** A directed graph. */
interface Graph<Node> {
    /** Computes the edges that leave from a node. */
    outgoingEdges(node : Node) : Edge<Node>[];
    /** A function that compares nodes. */
    compareNodes : collections.ICompareFunction<Node>;
}

/** Type that reports the result of a search. */
class SearchResult<Node> {
    /** The path (sequence of Nodes) found by the search algorithm. */
    path : Node[];
    /** The total cost of the path. */
    cost : number;
}

/** Wrapper class that store a node and the various cost values associated
    with that particular node (e.i. g and f costs) as well as a reference to
    a parent node (e.i. another custom queue element). */
class QueueElement<Node> {
    parent : QueueElement<Node>;
    node : Node;
    g : number;
    f : number;

    constructor(parent: QueueElement<Node>, node: Node, g: number, h: number) {
        this.parent = parent;
        this.node = node;
        this.g = g;
        this.f = g + h;
    }
}

/**
* A\* search implementation, parameterised by a `Node` type. The code
* here is just a template; you should rewrite this function
* entirely. In this template, the code produces a dummy search result
* which just picks the first possible neighbour.
*
* Note that you should not change the API (type) of this function,
* only its body.
* @param graph The graph on which to perform A\* search.
* @param start The initial node.
* @param goal A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
* @param heuristics The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
* @param timeout Maximum time (in seconds) to spend performing A\* search.
* @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
*/
function aStarSearch<Node> (
    graph : Graph<Node>,
    start : Node,
    goal : (n:Node) => boolean,
    heuristics : (n:Node) => number,
    timeout : number
) : SearchResult<Node> {
    var startTime = new Date().getTime();

    // The set (queue) of currently discovered nodes still to be evaluated, sorted by f score
    var frontier = new collections.PriorityQueue<QueueElement<Node>>(function(a: QueueElement<Node>, b: QueueElement<Node>) {
        return b.f - a.f;
    });

    // The set of nodes already evaluated
    var visited = new collections.Set<Node>();

    // Initially, only the start node is known
    frontier.add(new QueueElement(null, start, 0, heuristics(start)));

    while (!frontier.isEmpty()) {
        if (new Date().getTime() - startTime > timeout * 1000) {
            throw new Error("Reached timeout before finding a path");
        }

        var current = frontier.dequeue();

        // Skip already visited nodes
        if (!visited.contains(current.node)) {
            if (goal(current.node)) {
                // It we are at the goal, lets backtrack the final path

                var result : SearchResult<Node> = {
                    path: [],
                    cost: current.g
                };

                while (current) {
                    result.path.push(current.node);
                    current = current.parent;
                }

                result.path.reverse();
                return result;
            }

            visited.add(current.node);

            // Add every nonvisited neighbor node to the frontier
            for (var edge of graph.outgoingEdges(current.node)) {
                if (!visited.contains(edge.to)) {
                    frontier.add(new QueueElement(current, edge.to, current.g + edge.cost, heuristics(edge.to)));
                }
            }
        }
    }

    throw new Error("Could not find a path");
}
