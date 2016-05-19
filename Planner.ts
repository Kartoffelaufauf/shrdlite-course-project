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
        var graph = new PlannerGraph(state.objects);
        var start = new PlannerNode(state.stacks, state.holding, state.arm);
        var _goal = (n: PlannerNode) => goal(interpretations, state.objects, n);
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
        var result : number[] = [];

        interpretations.forEach(function(interpretation) {
            interpretation.forEach(function(condition) {
                var _heuristics = 0;

                var first = condition.args[0];
                var firstStackIndex = getStackIndex(n.stacks, first) || n.arm;

                if (condition.relation === 'holding' && n.holding !== first) {
                    _heuristics += n.holding ? 2 : 1;
                    _heuristics += Math.abs(n.arm - firstStackIndex);
                    _heuristics += (n.stacks[firstStackIndex].length - n.stacks[firstStackIndex].indexOf(first) - 1) * 4;
                } else {
                    var second = condition.args[1];

                    // Because left- & rightof and above & under have sort of commutative properties
                    if (['rightof', 'under'].indexOf(condition.relation) > -1) {
                        var tmp = first;
                        first = second;
                        second = tmp;
                        firstStackIndex = getStackIndex(n.stacks, first) || n.arm;
                    }

                    var secondStackIndex = getStackIndex(n.stacks, second) || n.arm;
                    var stackDifference = Math.abs(firstStackIndex - secondStackIndex);
                    var firstStackPos = n.stacks[firstStackIndex].indexOf(first);
                    var secondStackPos = n.stacks[secondStackIndex].indexOf(second);
                    var numAboveFirst = firstStackPos === -1 ? 0 : (n.stacks[firstStackIndex].length - firstStackPos - 1);
                    var numAboveSecond = secondStackPos === -1 ? 0 : (n.stacks[secondStackIndex].length - secondStackPos - 1);
                    var holdingOneOfThem = firstStackPos === -1 || secondStackPos === -1;

                    if (['leftof', 'rightof'].indexOf(condition.relation) > -1 && !(firstStackIndex < secondStackIndex && !holdingOneOfThem)) {
                        var numToMove = secondStackIndex === 0 ? numAboveSecond : (firstStackIndex === n.stacks.length - 1 ? numAboveFirst : Math.min(numAboveFirst, numAboveSecond));
                        _heuristics += numToMove * 4;
                        _heuristics += firstStackIndex >= secondStackIndex ? firstStackIndex - secondStackIndex + 1 : 0;
                        _heuristics += [first, second].indexOf(n.holding) > -1 ? 1 : 2;
                    } else if (condition.relation === 'beside' && !(stackDifference === 1 && !holdingOneOfThem)) {
                        _heuristics += Math.min(numAboveFirst, numAboveSecond) * 4;
                        _heuristics += Math.abs(Math.abs(firstStackIndex - secondStackIndex) - 1);
                        _heuristics += [first, second].indexOf(n.holding) > -1 ? 1 : 2;
                    } else if (['inside', 'ontop'].indexOf(condition.relation) > -1 && !(stackDifference === 0 && firstStackPos === secondStackPos + 1 && !holdingOneOfThem)) {
                        _heuristics += numAboveSecond * 4;
                        _heuristics += numAboveFirst * 4;
                        _heuristics += Math.abs(firstStackIndex - secondStackIndex);
                        _heuristics += n.holding === first ? 1 : 2;
                    } else if (['above', 'under'].indexOf(condition.relation) > -1 && !(stackDifference === 0 && firstStackPos > secondStackPos && !holdingOneOfThem)) {
                        _heuristics += numAboveFirst * 4;
                        _heuristics += Math.abs(firstStackIndex - secondStackIndex);
                        _heuristics += n.holding === first ? 1 : 2;
                    }
                }

                result.push(_heuristics);
            });
        });

        return Math.min.apply(null, result);
    }

    function goal(interpretations : Interpreter.DNFFormula, objects: { [s:string]: ObjectDefinition; }, n: PlannerNode) : boolean {
        var _goal = false;

        for (var i = 0; i < interpretations.length && !_goal; i++) {
            var conditionFulfilled = true;

            for (var j = 0; j < interpretations[i].length && conditionFulfilled; j++) {
                var condition = interpretations[i][j];
                var first = condition.args[0];

                if (condition.relation === 'holding') {
                    if (n.holding !== first) conditionFulfilled = false;
                } else {
                    var second = condition.args[1];
                    var firstStackIndex = getStackIndex(n.stacks, first);

                    if (firstStackIndex == null) {
                        conditionFulfilled = false;
                        continue;
                    }

                    var firstStackPos = n.stacks[firstStackIndex].indexOf(first);

                    if (second !== 'floor') {
                        var secondStackIndex = getStackIndex(n.stacks, second);

                        if (secondStackIndex == null) {
                            conditionFulfilled = false;
                            continue;
                        }

                        var secondStackPos = n.stacks[secondStackIndex].indexOf(second);
                        var secondType = objects[second].form;

                        if (condition.relation === 'leftof') {
                            if (!(firstStackIndex < secondStackIndex)) conditionFulfilled = false;
                        } else if (condition.relation === 'rightof') {
                            if (!(firstStackIndex > secondStackIndex)) conditionFulfilled = false;
                        } else if (condition.relation === 'beside') {
                            if (Math.abs(firstStackIndex - secondStackIndex) !== 1) conditionFulfilled = false;
                        } else if (['inside', 'ontop'].indexOf(condition.relation) > -1) {
                            if (!(firstStackPos - secondStackPos === 1) || firstStackIndex !== secondStackIndex) conditionFulfilled = false;
                        } else if (condition.relation === 'above') {
                            if (!(firstStackPos > secondStackPos) || firstStackIndex !== secondStackIndex) conditionFulfilled = false;
                        } else if (condition.relation === 'under') {
                            if (!(firstStackPos < secondStackPos) || firstStackIndex !== secondStackIndex) conditionFulfilled = false;
                        }
                    } else if (condition.relation === 'ontop' && firstStackPos !== 0) {
                        conditionFulfilled = false;
                    }
                }
            }

            if (conditionFulfilled) _goal = true;
        }

        return _goal;
    }

    class PlannerGraph implements Graph<PlannerNode> {
        constructor(public objects : { [s:string]: ObjectDefinition; }) {}

        outgoingEdges(node : PlannerNode) : Edge<PlannerNode>[] {
            var outgoing : Edge<PlannerNode>[] = [];
            var self = this;

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
                    var holdForm = holding ? self.objects[holding].form : null;
                    var holdSize = holding ? self.objects[holding].size : null;
                    var topForm = stacks[arm][0] ? self.objects[stacks[arm][stacks[arm].length - 1]].form : null;
                    var topSize = stacks[arm][0] ? self.objects[stacks[arm][stacks[arm].length - 1]].size : null;

                    if ((holding === null) ||
                        (topSize === 'small' && holdSize === 'large') ||                                                        // Small objects cannot support large objects
                        (topForm && topForm !== 'box' && holdForm === 'ball') ||                                                // Balls must be in boxes or on the floor, otherwise they roll away
                        (topForm === 'ball') ||                                                                                 // Balls cannot support anything
                        (topForm === 'box' && ['pyramid', 'plank', 'box'].indexOf(holdForm) !== -1 && topSize === holdSize) ||  // Boxes cannot contain pyramids, planks or boxes of the same size
                        (topSize === 'small' && ['brick', 'pyramid'].indexOf(topForm) !== -1 && holdForm === 'box') ||          // Small boxes cannot be supported by small bricks or pyramids
                        (topForm === 'pyramid' && holdForm === 'box' && holdSize === topSize)) {                                // Large boxes cannot be supported by large pyramids
                        return;
                    }

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
