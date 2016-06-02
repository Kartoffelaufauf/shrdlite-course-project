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
        var plan : string[] = [];

        var start = new PlannerNode(state.stacks, state.holding, state.arm);
        if (interpretations[0][0].relation === 'where') {
            var locations : string[] = [];

            interpretations.forEach(function(matches) {
                var stackIndex = getStackIndex(state.stacks, matches[0].args[0]);

                if (stackIndex > -1) {
                    var stackPos = state.stacks[stackIndex].indexOf(matches[0].args[0]);
                    locations.push('in the ' + mapNumberToText(stackIndex) + ' stack ' + getDescription(start, state.objects, state.stacks[stackIndex][stackPos - 1]));
                } else {
                    locations.push('in the claw');
                }
            });

            var locationString = (locations.length > 1 ? 'There are many. The first one is ' : 'It is ') + locations.join(" and another ") + '.';
            plan.push(locationString);
        } else {
            var graph = new PlannerGraph(state.objects);
            var _goal = (n: PlannerNode) => goal(interpretations, state.objects, n);
            var _heuristics = (n: PlannerNode) => heuristics(interpretations, n);
            var result = aStarSearch(graph, start, _goal, _heuristics, 100);
            result.path.shift();

            result.path.forEach(function(node) {
                if (node.description) plan.push(node.description);
                plan.push(node.command);
            });

            console.log('Goal count: ' + goalCount);
            console.log('Plan length:' + plan.length);
        }

        return plan;
    }

    /**
     * Get which stack a certain entity belongs to.
     * A stack is an array of 0 or more entities stacked ontop of eachother.
     * @param  stacks   All stacks in the current world
     * @param  entity   The entity for which to get the location
     * @param  _default A default stack index, if none is found
     * @return          A number representing the stack where the
     *                  entity is located.
     */
    function getStackIndex(stacks : Stack[], entity : string, _default? : number) : number {
        var stackIndex = _default;

        for (var i = 0; i < stacks.length; i++) {
            if (stacks[i].indexOf(entity) > -1) {
                stackIndex = i;
                break;
            }
        }

        return stackIndex;
    }

    /**
     * Generates a human readable description from an arm-instruction.
     * The function makes sure no unnecessary information is included, for
     * example not returning "... the big white ball" if there is only one ball,
     * but instead: "... the ball"
     * @param  node    The current PlannerNode
     * @param  objects All objects that could possibly exist in the current world
     * @param  entity  The entity currently being manipulated in some way
     * @param  action  What will happen with said entity
     * @return         A correct String, to be printed for the user
     */
    function getDescription(node : PlannerNode, objects : { [s:string]: ObjectDefinition; }, entity : string, action? : string) : string {
        var result = '';

        // The result is what we finally write and here we trasform the first simple commands
        // either picking up och putting
        if (action === 'p') {
            result = 'Picking up ';
        } else if (action === 'd') {
            result = 'Putting it ';
        }

        //Here the full action of a command will be written to the final sentence that describes a node.
        //Depending on which move is mad this is catched by if statements.
        //We take in consideration to where the item is placed and if its placed above something we find it
        //and display it for a better representation of where we placed a item.
        if (entity) {
            if (action !== 'p') result += objects[entity].form === 'box' ? 'inside ' : 'on ';

            if (['p', 'd'].indexOf(action) > -1) {
                var existing : string[] = Array.prototype.concat.apply([], node.stacks);
                if (node.holding !== null) existing.push(node.holding);
                existing.splice(existing.indexOf(entity), 1);
            } else {
                var existing : string[] = node.stacks[getStackIndex(node.stacks, entity)].slice(0);
                existing.splice(existing.indexOf(entity), 1);
            }

            // Used to keep track of the number of a certain form/color/size
            var numSameForm = existing.reduce((sum, e) => sum + (objects[e].form === objects[entity].form ? 1 : 0), 0);
            var numSameFormColor = existing.reduce((sum, e) => sum + (objects[e].form === objects[entity].form && objects[e].color === objects[entity].color ? 1 : 0), 0);
            var numSameFormSize = existing.reduce((sum, e) => sum + (objects[e].form === objects[entity].form && objects[e].size === objects[entity].size ? 1 : 0), 0);
            var numSameFormColorSize = existing.reduce((sum, e) => sum + (objects[e].form === objects[entity].form && objects[e].color === objects[entity].color && objects[e].size === objects[entity].size ? 1 : 0), 0);

            // Used to filter out the unnecessary information, deciding which
            // adjectives to keep, depending on how many of a certain
            // form/color/size that exist in the current world
            if (numSameForm === 0) {
                result += 'the ' + objects[entity].form;
            } else if (numSameFormColor === 0) {
                result += 'the ' + objects[entity].color + ' ' + objects[entity].form;
            } else if (numSameFormSize === 0) {
                result += 'the ' + objects[entity].size + ' ' + objects[entity].form;
            } else if (numSameFormColorSize === 0) {
                result += 'the ' + objects[entity].size + ' ' + objects[entity].color + ' ' + objects[entity].form;
            } else {
                if (action) {
                    result += 'a ';
                } else {
                    existing = node.stacks[getStackIndex(node.stacks, entity)].slice(0);
                    existing.splice(existing.indexOf(entity));
                    numSameFormColorSize = existing.reduce((sum, e) => sum + (objects[e].form === objects[entity].form && objects[e].color === objects[entity].color && objects[e].size === objects[entity].size ? 1 : 0), 0);
                    result += 'the ' + mapNumberToText(numSameFormColorSize) + ' ';
                }

                result += objects[entity].size + ' ' + objects[entity].color + ' ' + objects[entity].form;
            }
        } else {
            result += 'on the floor';
        }

        return result + (action ? '.' : '');
    }

    /**
     * Used to convert a number to an enumerating form.
     * For example 1 is "first" & 5 is 5th.
     * @param  num The number to "speechify"
     * @return     The number in a better described way
     */
    function mapNumberToText(num : number) : string {
        if (num > 2) {
            return (num + 1) + 'th';
        } else {
            return ['first', 'second', 'third'][num];
        }
    }

    /**
     * A function used to calculate the heuristics for the aStarPlanner.
     * TODO Behövs mer här?
     * @param  interpretations TODO vad är här?
     * @param  n               The current PlannerNode
     * @return                 The cost of the potential next move
     */
    function heuristics(interpretations : Interpreter.DNFFormula, n: PlannerNode) : number {
        var result : number[] = [];
        interpretations.forEach(function(interpretation) {
            var _heuristics = 0;

            interpretation.forEach(function(condition) {
                var first = condition.args[0];

                var firstStackIndex = getStackIndex(n.stacks, first, n.arm);
                var firstStackPos = n.stacks[firstStackIndex].indexOf(first);
                var numAboveFirst = firstStackPos === -1 ? 0 : (n.stacks[firstStackIndex].length - firstStackPos - 1);
                /**
                * For a given condition we calculate the heuristics depending on which relation
                * and wheres the arm is located.
                */
                if (condition.relation === 'holding' && n.holding !== first) {
                    _heuristics += Math.abs(firstStackIndex - n.arm) + (numAboveFirst * 4) + (n.holding ? 2 : 1);
                } else {
                    var second = condition.args[1];

                    // Because left- & rightof and above & under have sort of
                    // commutative properties, we switch their reference, to
                    // decrease the number of special cases needed to be checked.
                    // 'rigtof' becomes 'leftof' & 'under' becomes 'above'
                    if (['rightof', 'under'].indexOf(condition.relation) > -1) {
                        var tmp = first;
                        first = second;
                        second = tmp;

                        firstStackIndex = getStackIndex(n.stacks, first, n.arm);
                        firstStackPos = n.stacks[firstStackIndex].indexOf(first);
                        numAboveFirst = firstStackPos === -1 ? 0 : (n.stacks[firstStackIndex].length - firstStackPos - 1);
                    }

                    var secondStackIndex = getStackIndex(n.stacks, second, n.arm);
                    var stackDifference = Math.abs(firstStackIndex - secondStackIndex);
                    var secondStackPos = n.stacks[secondStackIndex].indexOf(second);
                    var numAboveSecond = secondStackPos === -1 ? 0 : (n.stacks[secondStackIndex].length - secondStackPos - 1);
                    var holdingOneOfThem = firstStackPos === -1 || secondStackPos === -1;

                    //To get the right heuristics we need to take in considerations the relations of the elements in the world
                    //this to be able to get the right element to move that is the most efficient.
                    // numAboveXXXX * 4 comes from moving to the entity, picking
                    // it up, moving away and then dropping it. This is when
                    // exposing the entity you want to manipulate
                    if (['leftof', 'rightof'].indexOf(condition.relation) > -1 && !(firstStackIndex < secondStackIndex && !holdingOneOfThem)) {
                        // Separate case if one of the entities is already in the claw,
                        // then that particular item won't have to be exposed
                        // and/or picked up.
                        if (!holdingOneOfThem) {
                            // Edge case, where both entities are at the edge
                            if (secondStackIndex === 0 && firstStackIndex === n.stacks.length - 1) {
                                _heuristics += Math.min(Math.abs(firstStackIndex - n.arm), Math.abs(secondStackIndex - n.arm)) + Math.abs(firstStackIndex - secondStackIndex) * 2 + (numAboveFirst + numAboveSecond) * 4 + 2;
                            // If one of the entities are at the edge but not
                            // the other, it might be faster to move that one
                            } else if (secondStackIndex === 0) {
                                _heuristics += Math.abs(secondStackIndex - n.arm) + numAboveSecond * 4 + 1 + Math.abs(firstStackIndex - secondStackIndex) + 2;
                            } else if (firstStackIndex === n.stacks.length - 1) {
                                _heuristics += Math.abs(firstStackIndex - n.arm) + numAboveFirst * 4 + 1 + Math.abs(firstStackIndex - secondStackIndex) + 2;
                            // If no entity is at the edge, move the one which
                            // is easiest to expose
                            } else {
                                _heuristics += Math.min(Math.abs(firstStackIndex - n.arm) + numAboveFirst * 4, Math.abs(secondStackIndex - n.arm) + numAboveSecond * 4) + 1 + Math.abs(firstStackIndex - secondStackIndex) + 2;
                            }
                        } else {
                            // If the goal can be fulfilled simply by dropping
                            // the held entity, just do so
                            if (n.holding === first && n.arm < secondStackIndex || n.holding === second && n.arm > firstStackIndex) {
                                _heuristics += 1;
                            } else {
                                // If the entity to manipulate is held, move
                                // the specified number of stacks in the correct
                                // direction and drop it.
                                _heuristics += n.holding === first ? n.arm - secondStackIndex + 2 : firstStackIndex - n.arm + 2;

                                // If holding the entity to manipulate and the
                                // other entity is at an edge, the current
                                // entity has to be put down and the other
                                // entity moved first
                                if (n.holding === first && secondStackIndex === 0) {
                                    _heuristics += numAboveSecond * 4 + 3;
                                } else if (n.holding === second && firstStackIndex === n.stacks.length - 1) {
                                    _heuristics += numAboveFirst * 4 + 3;
                                }
                            }
                        }
                    // If one entity should be beside the other, move the one
                    // that's easiest to access
                    } else if (condition.relation === 'beside' && !(stackDifference === 1 && !holdingOneOfThem)) {
                        /* TODO Fix multi-line if-else */
                        _heuristics += !holdingOneOfThem ? Math.min(Math.abs(firstStackIndex - n.arm) + numAboveFirst * 4, Math.abs(secondStackIndex - n.arm) + numAboveSecond * 4) + 1 + Math.abs(firstStackIndex - secondStackIndex) : n.holding === first ? Math.abs(secondStackIndex - n.arm) : Math.abs(firstStackIndex - n.arm);
                    } else if (['inside', 'ontop'].indexOf(condition.relation) > -1 && !(stackDifference === 0 && firstStackPos === secondStackPos + 1 && !holdingOneOfThem)) {
                        _heuristics += n.holding !== first ? Math.abs(firstStackIndex - n.arm) + (numAboveFirst * 4) + 1 + Math.abs(firstStackIndex - secondStackIndex) + (numAboveSecond * 4) + 1 : Math.abs(secondStackIndex - n.arm) + (numAboveSecond * 4) + 1;
                    } else if (['above', 'under'].indexOf(condition.relation) > -1 && !(stackDifference === 0 && firstStackPos > secondStackPos && !holdingOneOfThem)) {
                        _heuristics += n.holding !== first ? Math.abs(firstStackIndex - n.arm) + (numAboveFirst * 4) + 1 + Math.abs(firstStackIndex - secondStackIndex) + 1 : Math.abs(secondStackIndex - n.arm) + 1;
                    }
                }
            });

            result.push(_heuristics);
        });

        return Math.min.apply(null, result);
    }

    var goalCount: number = 0;

    /**
     * TODO Not sure
     * @param  interpretations TODO
     * @param  objects         All objects that could possibly exist in the current world
     * @param  n               To current PlannerNode
     * @return                 Simply returns if the goal is reached or not
     */
    function goal(interpretations : Interpreter.DNFFormula, objects: { [s:string]: ObjectDefinition; }, n: PlannerNode) : boolean {
        goalCount++;

        var _goal = false;
        // For each different interpretetion we check if the goal is reached.
        // if one or more is fulfilled we changed the goal to be true.
        for (var i = 0; i < interpretations.length && !_goal; i++) {
            var conditionFulfilled = true;
            // Checks so that a interpretation with its conditions is fullfield.
            // if all conditions is fullfilled we return true or false
            // It's implemented in a way that assumes the goal is fulfilled
            // and sets it to false if anything is found which doesn't
            // matches the desired goal
            for (var j = 0; j < interpretations[i].length && conditionFulfilled; j++) {
                var condition = interpretations[i][j];
                var first = condition.args[0];

                if (condition.relation === 'holding') {
                    if (n.holding !== first) conditionFulfilled = false;
                } else {
                    var second = condition.args[1];
                    var firstStackIndex = getStackIndex(n.stacks, first);

                    /* TODO hmm */
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

                        // Simply checks to see if the relevant contidion is
                        // fulfilled
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

    /**
     * TODO wat iz diz
     */
    class PlannerGraph implements Graph<PlannerNode> {
        constructor(public objects : { [s:string]: ObjectDefinition; }) {}

        outgoingEdges(node : PlannerNode) : Edge<PlannerNode>[] {
            var outgoing : Edge<PlannerNode>[] = [];
            var self = this;

            ['l', 'r', 'p', 'd'].forEach(function(command) {
                // Not necessary for time complexity of search, but help with memory consumption
                if ((node.command === 'l' && command === 'r') ||
                    (node.command === 'r' && command === 'l') ||
                    (node.command === 'p' && command === 'd') ||
                    (node.command === 'd' && command === 'p'))
                    return;

                var stacks = JSON.parse(JSON.stringify(node.stacks));
                var holding = node.holding;
                var arm = node.arm;

                var description : string;

                /* TODO fix */
                if (command === 'l') {
                    if (arm <= 0) return;
                    arm--;
                } else if (command === 'r') {
                    if (arm >= stacks.length - 1) return;
                    arm++;
                } else if (command === 'p') {
                    if (holding !== null || stacks[arm].length <= 0) return;
                    holding = stacks[arm].pop();

                    description = getDescription(node, self.objects, holding, 'p');
                // Before dropping an entity, we have to make sure the
                // entity underneath can support it
                } else if (command === 'd') {
                    var holdForm = holding ? self.objects[holding].form : null;
                    var holdSize = holding ? self.objects[holding].size : null;
                    var topForm = stacks[arm][0] ? self.objects[stacks[arm][stacks[arm].length - 1]].form : null;
                    var topSize = stacks[arm][0] ? self.objects[stacks[arm][stacks[arm].length - 1]].size : null;

                    if ((holding === null) ||
                        // Small objects cannot support large objects
                        (topSize === 'small' && holdSize === 'large') ||
                        // Balls must be in boxes or on the floor, otherwise they roll away
                        (topForm && topForm !== 'box' && holdForm === 'ball') ||
                        // Balls cannot support anything
                        (topForm === 'ball') ||
                        // Boxes cannot contain pyramids, planks or boxes of the same size
                        (topForm === 'box' && ['pyramid', 'plank', 'box'].indexOf(holdForm) !== -1 && topSize === holdSize) ||
                        // Small boxes cannot be supported by small bricks or pyramids
                        (topSize === 'small' && ['brick', 'pyramid'].indexOf(topForm) !== -1 && holdForm === 'box') ||
                        // Large boxes cannot be supported by large pyramids
                        (topForm === 'pyramid' && holdForm === 'box' && holdSize === topSize)) {
                        return;
                    }

                    stacks[arm].push(holding);
                    holding = null;

                    description = getDescription(node, self.objects, stacks[arm][stacks[arm].length - 2], 'd');
                }

                outgoing.push({
                    from: node,
                    to: new PlannerNode(stacks, holding, arm, command, description),
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
            stacks : Stack[],            // All current stacks in the world
            public holding : string,     // Entity currently held by the arm
            public arm : number,         // The current positon of the arm
            public command? : string,    // An optional command for the arm
            public description? : string // An optional description to be printed
        ) {
            this.stacks = JSON.parse(JSON.stringify(stacks));
        }

        toString() : string {
            return JSON.stringify({stacks: this.stacks, holding: this.holding, arm: this.arm});
        }
    }
}
