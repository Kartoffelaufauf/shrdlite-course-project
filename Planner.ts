///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Graph.ts"/>

/**
* Planner module
*
* The goal of the Planner module is to take the interpetation(s)
* produced by the Interpreter module and to plan a sequence of actions
* for the robot to put the world into a state compatible with the
* user's command, i.e. to achieve what the user wanted.
*
* The planner should use your A* search implementation to find a plan.
*/
module Planner {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    /**
     * Top-level driver for the Planner. Calls `planInterpretation` for each given interpretation generated by the Interpreter.
     * @param interpretations List of possible interpretations.
     * @param currentState The current state of the world.
     * @returns Augments Interpreter.InterpretationResult with a plan represented by a list of strings.
     */
    export function plan(interpretations : Interpreter.InterpretationResult[], currentState : WorldState) : PlannerResult[] {
        var errors : Error[] = [];
        var plans : PlannerResult[] = [];
        interpretations.forEach((interpretation) => {
            try {
                var result : PlannerResult = <PlannerResult>interpretation;
                result.plan = planInterpretation(result.interpretation, currentState);
                if (result.plan.length == 0) {
                    result.plan.push("That is already true!");
                }
                plans.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (plans.length) {
            return plans;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface PlannerResult extends Interpreter.InterpretationResult {
        plan : string[];
    }

    export function stringify(result : PlannerResult) : string {
        return result.plan.join(", ");
    }

    //////////////////////////////////////////////////////////////////////
    // private functions

    /**
     * The core planner function. The code here is just a template;
     * you should rewrite this function entirely. In this template,
     * the code produces a dummy plan which is not connected to the
     * argument `interpretation`, but your version of the function
     * should be such that the resulting plan depends on
     * `interpretation`.
     *
     *
     * @param interpretation The logical interpretation of the user's desired goal. The plan needs to be such that by executing it, the world is put into a state that satisfies this goal.
     * @param state The current world state.
     * @returns Basically, a plan is a
     * stack of strings, which are either system utterances that
     * explain what the robot is doing (e.g. "Moving left") or actual
     * actions for the robot to perform, encoded as "l", "r", "p", or
     * "d". The code shows how to build a plan. Each step of the plan can
     * be added using the `push` method.
     */
    function planInterpretation(interpretations : Interpreter.DNFFormula, state : WorldState) : string[] {
        var graph = new PlannerGraph();
        var start = new PlannerNode(state.stacks, state.holding, state.arm);
        var _goal = (n: PlannerNode) => goal(interpretations, n);
        var _heuristics = (n: PlannerNode) => heuristics(interpretations, n);

        var result = aStarSearch(graph, start, _goal, _heuristics, 10);
        result.path.shift();

        var plan : string[] = [];

        result.path.forEach(function(node) {
            plan.push(node.command);
        });

        return plan;
    }

    function getStackIndex(stacks : Stack[], entity : string) : number {
        var stackIndex : number;
        for (var i = 0; i < stacks.length; i++) {
            if (stacks[i].indexOf(entity) > -1) {
                stackIndex = i;
                break;
            }
        }

        return stackIndex;
    }

    function heuristics(interpretations : Interpreter.DNFFormula, n: PlannerNode) : number {
        return 0; /* TODO: Implement a *smart* heuristics */
    }

    function goal(interpretations : Interpreter.DNFFormula, n: PlannerNode) : boolean {
        var _goal = false;

        for (var i = 0; i < interpretations.length && !_goal; i++) {
            var conditionFulfilled = true;

            for (var j = 0; j < interpretations[i].length && conditionFulfilled; j++) {
                var condition = interpretations[i][j];

                if (condition.relation === 'holding') {
                    if (n.holding !== condition.args[0]) conditionFulfilled = false;
                } else {
                    var first = condition.args[0];
                    var second = condition.args[1];

                    var firstStackIndex = getStackIndex(n.stacks, first);
                    var secondStackIndex = getStackIndex(n.stacks, second);

                    if (firstStackIndex === null || secondStackIndex === null) {
                        conditionFulfilled = false;
                        continue;
                    }

                    if (condition.relation === 'leftof') {
                        if (!(firstStackIndex < secondStackIndex)) conditionFulfilled = false;
                    } else if (condition.relation === 'rightof') {
                        if (!(firstStackIndex > secondStackIndex)) conditionFulfilled = false;
                    } else if (condition.relation === 'beside') {
                        if (Math.abs(firstStackIndex - secondStackIndex) !== 1) conditionFulfilled = false;
                    } else if (condition.relation === 'inside') {
                        /* TODO */
                    } else if (condition.relation === 'ontop') {
                        /* TODO */
                    } else if (condition.relation === 'above') {
                        /* TODO */
                    } else if (condition.relation === 'under') {
                        /* TODO */
                    }
                }
            }

            if (conditionFulfilled) _goal = true;
        }

        return _goal;
    }

    class PlannerGraph implements Graph<PlannerNode> {
        outgoingEdges(node : PlannerNode) : Edge<PlannerNode>[] {
            var outgoing : Edge<PlannerNode>[] = [];

            ['l', 'r', 'p', 'd'].forEach(function(command) {
                var stacks = node.stacks;
                var holding = node.holding;
                var arm = node.arm;

                if (command === 'l') {
                    if (arm <= 0) return;

                    arm--;
                } else if (command === 'r') {
                    if (arm >= stacks.length - 1) return;

                    arm++;
                } else if (command === 'p') {
                    if (holding !== null || stacks[arm].length <= 0) return;

                    holding = stacks[arm].pop();
                } else if (command === 'd') {
                    if (holding === null) return; /* TODO:  A better check if it is possible to drop here (physics laws),
                                                            look at the Interpreter and copy */
                    stacks[arm].push(holding);
                    holding = null;
                }

                outgoing.push({
                    from: node,
                    to: new PlannerNode(stacks, holding, arm, command),
                    cost: 1
                });
            });

            return outgoing;
        }

        compareNodes(a : PlannerNode, b : PlannerNode) : number {
            return 0;
        }
    }

    class PlannerNode {
        public stacks: Stack[];

        constructor(
            stacks : Stack[],
            public holding : string,
            public arm : number,
            public command? : string
        ) {
            this.stacks = JSON.parse(JSON.stringify(stacks));
        }

        toString() : string {
            return JSON.stringify(this);
        }
    }
}
