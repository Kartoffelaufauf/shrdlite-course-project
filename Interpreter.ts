///<reference path="World.ts"/>
///<reference path="Parser.ts"/>

/**
* Interpreter module
*
* The goal of the Interpreter module is to interpret a sentence
* written by the user in the context of the current world state. In
* particular, it must figure out which objects in the world,
* i.e. which elements in the `objects` field of WorldState, correspond
* to the ones referred to in the sentence.
*
* Moreover, it has to derive what the intended goal state is and
* return it as a logical formula described in terms of literals, where
* each literal represents a relation among objects that should
* hold. For example, assuming a world state where "a" is a ball and
* "b" is a table, the command "put the ball on the table" can be
* interpreted as the literal ontop(a,b). More complex goals can be
* written using conjunctions and disjunctions of these literals.
*
* In general, the module can take a list of possible parses and return
* a list of possible interpretations, but the code to handle this has
* already been written for you. The only part you need to implement is
* the core interpretation function, namely `interpretCommand`, which produces a
* single interpretation for a single command.
*/
module Interpreter {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    /**
    Top-level function for the Interpreter. It calls `interpretCommand` for each possible parse of the command. No need to change this one.
    * @param parses List of parses produced by the Parser.
    * @param currentState The current state of the world.
    * @returns Augments ParseResult with a list of interpretations. Each interpretation is represented by a list of Literals.
    */
    export function interpret(parses : Parser.ParseResult[], currentState : WorldState) : InterpretationResult[] {
        var errors : Error[] = [];
        var interpretations : InterpretationResult[] = [];
        parses.forEach((parseresult) => {
            try {
                var result : InterpretationResult = <InterpretationResult>parseresult;
                result.interpretation = interpretCommand(result.parse, currentState);
                interpretations.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (interpretations.length) {
            return interpretations;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface InterpretationResult extends Parser.ParseResult {
        interpretation : DNFFormula;
    }

    export type DNFFormula = Conjunction[];
    type Conjunction = Literal[];

    /**
    * A Literal represents a relation that is intended to
    * hold among some objects.
    */
    export interface Literal {
        /** Whether this literal asserts the relation should hold
         * (true polarity) or not (false polarity). For example, we
         * can specify that "a" should *not* be on top of "b" by the
         * literal {polarity: false, relation: "ontop", args:
         * ["a","b"]}.
         */
        polarity : boolean;
        /** The name of the relation in question. */
        relation : string;
        /** The arguments to the relation. Usually these will be either objects
         * or special strings such as "floor" or "floor-N" (where N is a column) */
        args : string[];
    }

    export function stringify(result : InterpretationResult) : string {
        return result.interpretation.map((literals) => {
            return literals.map((lit) => stringifyLiteral(lit)).join(" & ");
            // return literals.map(stringifyLiteral).join(" & ");
        }).join(" | ");
    }

    export function stringifyLiteral(lit : Literal) : string {
        return (lit.polarity ? "" : "-") + lit.relation + "(" + lit.args.join(",") + ")";
    }

    //////////////////////////////////////////////////////////////////////
    // private functions
    /**
     * The core interpretation function. The code here is just a
     * template; you should rewrite this function entirely. In this
     * template, the code produces a dummy interpretation which is not
     * connected to `cmd`, but your version of the function should
     * analyse cmd in order to figure out what interpretation to
     * return.
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     * @throws An error when no valid interpretations can be found
     */
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {
        var objects : string[] = Array.prototype.concat.apply([], state.stacks);
        var interpretations : DNFFormula = [];

        if (cmd.command === 'where') {
            getEntities(state, cmd.entity.object).forEach(function(entity) {
                interpretations.push([{polarity: true, relation: 'where', args: [entity]}]);
            });
        } else if (cmd.command === 'drop' && state.holding) {
            interpretations.push([{polarity: true, relation: 'above', args: [state.holding, 'floor']}]);
        } else if (cmd.command === 'take') {
            var entities = getEntities(state, cmd.entity.object);

            // The arm can only hold one object at the time
            if (cmd.entity.quantifier !== 'all') {
                entities.forEach(function(entity) {
                    interpretations.push([{polarity: true, relation: 'holding', args: [entity]}]);
                });
            } else if (entities.length === 1) {
                interpretations.push([{polarity: true, relation: 'holding', args: [entities[0]]}]);
            }
        } else if (['move', 'put'].indexOf(cmd.command) > -1) {
            var first = cmd.command === 'move' ? getEntities(state, cmd.entity.object) : (state.holding !== null ? [state.holding] : []);
            var doRecursion = cmd.location.entity.quantifier === 'any' && cmd.location.entity.object.object;

            if (doRecursion) {
                var newCommand = {
                    command: 'move',
                    entity: {
                        quantifier: 'any',
                        object: cmd.location.entity.object.object
                    },
                    location: cmd.location.entity.object.location
                };

                interpretCommand(newCommand, state).forEach(function(interpretation) {
                    var interpretationCopy = interpretation.slice(0);

                    first.forEach(function(_first) {
                        if (cmd.entity.quantifier === 'all') {
                            if (isValid(cmd.location.relation, _first, interpretation[interpretation.length - 1].args[0])) {
                                interpretationCopy.push({polarity: true, relation: cmd.location.relation, args: [_first, interpretation[interpretation.length - 1].args[0]]});
                            }
                        } else {
                            if (isValid(cmd.location.relation, _first, interpretation[interpretation.length - 1].args[0])) {
                                interpretations.push(interpretation.concat({polarity: true, relation: cmd.location.relation, args: [_first, interpretation[interpretation.length - 1].args[0]]}));
                            }
                        }
                    });

                    if (cmd.entity.quantifier === 'all')
                        interpretations.push(interpretationCopy);
                });
            } else {
                var second = getEntities(state, cmd.location.entity.object);

                first.forEach(function(_first) {
                    second.forEach(function(_second) {
                        if (isValid(cmd.location.relation, _first, _second))
                            interpretations.push([{polarity: true, relation: cmd.location.relation, args: [_first, _second]}]);
                    });
                });
            }

            if (cmd.command === 'move' && (cmd.entity.quantifier === 'all' || cmd.location.entity.quantifier === 'all')) {
                if (!doRecursion && interpretations.length > 0)
                    interpretations = allQuantifierValidator(interpretations, state.objects, cmd.location.relation, cmd.entity.quantifier, cmd.location.entity.quantifier);

                // Make sure there is enough entities to fulfill the request
                if (['inside', 'ontop'].indexOf(cmd.location.relation) > -1) {
                    if (cmd.entity.quantifier === 'all' && cmd.location.entity.quantifier === 'all') {
                        if (!(first.length === 1 && second.length === 1)) interpretations = [];
                    } else if (cmd.entity.quantifier === 'all') {
                        if (!(first.length <= second.length)) interpretations = [];
                    } else {
                        if (!(first.length >= second.length)) interpretations = [];
                    }
                }

                // Make sure we got all entities matched by the all quantifier
                interpretations = interpretations.filter(function(interpretation) {
                    var _first = first.slice(0);
                    var _second = second.slice(0);

                    interpretation.forEach(function(condition) {
                        _first.splice(_first.indexOf(condition.args[0]), 1);
                        _second.splice(_second.indexOf(condition.args[1]), 1);
                    });

                    var fromAllCheck = cmd.entity.quantifier === 'all' ? _first.length === 0 : true;
                    var toAllCheck = cmd.location.entity.quantifier  === 'all' ? _second.length === 0 : true;

                    return fromAllCheck && toAllCheck;
                });

                // The floor can support at most N objects (beside each other)
                interpretations = interpretations.filter(function(interpretation) {
                    var nbrEntitiesOnTopOfFloor = 0;

                    interpretation.forEach(function(condition) {
                        if (condition.relation === 'ontop' && condition.args[1] === 'floor') nbrEntitiesOnTopOfFloor++;
                    });

                    return nbrEntitiesOnTopOfFloor <= state.stacks.length;
                });
            }
        }

        if (interpretations.length > 0)
            return interpretations;
        else
            throw "No interpretations possible";

        // ### HELPER FUNCTIONS BELOW ###

        function allQuantifierValidator(interpretations : Literal[][], objects : { [s:string]: ObjectDefinition; }, relation : string, fromQuantifier : string, toQuantifier : string) {
            if (fromQuantifier === 'all' && toQuantifier === 'all') {
                var result = [Array.prototype.concat.apply([], interpretations)];

                if (['above', 'under'].indexOf(relation) > -1) {
                    var entitiesSeen : string[] = [];

                    result[0].forEach(function(condition : Literal) {
                        var entity = relation === 'above' ? condition.args[0] : condition.args[1];

                        if (objects[entity].form === 'ball' && entitiesSeen.indexOf(entity) === -1)
                            entitiesSeen.push(entity);
                    });

                    if (entitiesSeen.length > 1) {
                        return [];
                    } else {
                        return result;
                    }
                } else {
                    return result;
                }
            }

            function cartesian(arg : Literal[][]) : Literal[][] {
                var r : Literal[][] = [], max = arg.length - 1;

                function helper(arr : Literal[], i : number) {
                    for (var j = 0, j < arg[i].length; j++) {
                        var a = arr.slice(0);
                        a.push(arg[i][j]);

                        if (i == max)
                            r.push(a);
                        else
                            helper(a, i+1);
                    }
                }

                helper([], 0);
                return r;
            }

            var groupConditionsByEntity: { [s: string] : Literal[]; } = {};
            interpretations.forEach(function(interpretation) {
                var entity = toQuantifier === 'all' ? interpretation[0].args[1] : interpretation[0].args[0];

                if (typeof groupConditionsByEntity[entity] === 'undefined') groupConditionsByEntity[entity] = [];
                groupConditionsByEntity[entity].push(interpretation[0]);
            });

            var groupConditionsByEntityValues : Literal[][] = [];
            for (var entity in groupConditionsByEntity) {
                if (groupConditionsByEntity.hasOwnProperty(entity)) {
                    groupConditionsByEntityValues.push(groupConditionsByEntity[entity]);
                }
            }

            return cartesian(groupConditionsByEntityValues).filter(function(combination) {
                var entitiesSeen : string[] = [];

                /* TODO: TEST THIS */
                if (['leftof', 'rightof', 'beside'].indexOf(cmd.location.relation) > -1) {
                    if (toQuantifier === 'all') {
                        return !combination.some(function(condition) {
                            if (entitiesSeen.length > 0 && entitiesSeen.indexOf(condition.args[0]) === -1) {
                                return true;
                            } else {
                                return entitiesSeen.push(condition.args[0]) && false;
                            }
                        });
                    } else {
                        return true;
                    }
                } else if (['ontop', 'inside'].indexOf(cmd.location.relation) > -1) {
                    // An entity cannot be ontop/inside multiple entities, and an entity cannot have multiple entities inside/ontop of it
                    return !combination.some(function(condition) {
                        if (condition.args[1] !== 'floor' && (entitiesSeen.indexOf(condition.args[0]) > -1 || entitiesSeen.indexOf(condition.args[1]) > -1)) {
                            return true;
                        } else {
                            return entitiesSeen.push(condition.args[0], condition.args[1]) && false;
                        }
                    });
                } else {
                    // Multiple balls cannot be above or under the same thing
                    return !combination.some(function(condition) {
                        var isBall = objects[condition.args[0]].form === 'ball';

                        if (condition.args[1] !== 'floor' && isBall && entitiesSeen.indexOf(condition.args[1]) > -1) {
                            return true;
                        } else {
                            if (isBall) entitiesSeen.push(condition.args[1]);
                            return false;
                        }
                    });
                }
            });
        }

        function isValid(relation : string, first : string, second : string) {
            if (first === second) return false;

            var firstSize = first !== 'floor' ? state.objects[first].size : null;
            var firstForm = first !== 'floor' ? state.objects[first].form : null;
            var secondSize = second !== 'floor' ? state.objects[second].size : null;
            var secondForm = second !== 'floor' ? state.objects[second].form : null;

            if ((second !== 'floor' && ['inside', 'ontop', 'above'].indexOf(relation) > -1 && firstSize === 'large' && secondSize === 'small') ||                     // Small objects cannot support large objects, pt. 1
                (relation === 'under' && firstSize === 'small' && secondSize === 'large') ||                                                                          // Small objects cannot support large objects, pt. 2
                (firstForm === 'ball' && !(relation === 'inside' || (relation === 'ontop' ? second === 'floor' : true))) ||                                           // Balls must be in boxes or on the floor, otherwise they roll away
                (second !== 'floor' && ['ontop', 'above'].indexOf(relation) > -1 && secondForm === 'ball') ||                                                         // Balls cannot support anything
                !(relation === 'inside' ? secondForm === 'box' : (relation === 'ontop' ? (second === 'floor' || secondForm !== 'box') : true)) ||                     // Objects are “inside” boxes, but “ontop” of other objects
                (secondForm === 'box' && relation === 'inside' && ['pyramid', 'plank', 'box'].indexOf(firstForm) > -1 && firstSize === secondSize) ||                 // Boxes cannot contain pyramids, planks or boxes of the same size
                (firstSize === 'small' && firstForm === 'box' && relation === 'ontop' && secondSize === 'small' && ['brick', 'pyramid'].indexOf(secondForm) > -1) ||  // Small boxes cannot be supported by small bricks or pyramids
                (firstSize === 'large' && firstForm === 'box' && relation === 'ontop' && secondSize === 'large' && secondForm === 'pyramid') ||                       // Large boxes cannot be supported by large pyramids
                (second === 'floor' && ['ontop', 'above'].indexOf(relation) === -1) ||                                                                                // An object can only be ontop or above the floor
                (first === 'floor')) {                                                                                                                                // The floor cannot be moved
                return false;
            }

            return true;
        }

        function getEntities(state : WorldState, condition : Parser.Object) : string[] {
            function getStackIndex(entity : string) : number {
                var stackIndex : number;
                for (var i = 0; i < state.stacks.length; i++) {
                    if (state.stacks[i].indexOf(entity) > -1) {
                        stackIndex = i;
                        break;
                    }
                }

                return stackIndex;
            }

            var existing : string[] = Array.prototype.concat.apply([], state.stacks);
            if (state.holding !== null) existing.push(state.holding);

            var result : Array<string> = new Array<string>();

            if (condition.form === 'floor')
                return ['floor'];

            if ('location' in condition) {
                var first : string[] = getEntities(state, condition.object);
                var second : string[] = getEntities(state, condition.location.entity.object);

                first.forEach(function(_first : string) {
                    var firstStackIndex : number = getStackIndex(_first);

                    second.some(function(_second : string) {
                        var secondStackIndex : number = getStackIndex(_second);

                        if (condition.location.relation === 'leftof') {
                            return firstStackIndex < secondStackIndex ? result.push(_first) && true : false;
                        } else if (condition.location.relation === 'rightof') {
                            return firstStackIndex > secondStackIndex ? result.push(_first) && true : false;
                        } else if (condition.location.relation === 'beside') {
                            return Math.abs(firstStackIndex - secondStackIndex) === 1 ? result.push(_first) && true : false;
                        } else if (condition.location.relation === 'inside') {
                            return state.objects[_second].form === 'box' && firstStackIndex === secondStackIndex && state.stacks[firstStackIndex].indexOf(_first) === state.stacks[secondStackIndex].indexOf(_second) + 1 ? result.push(_first) && true : false;
                        } else if (condition.location.relation === 'ontop') {
                            if (_second === 'floor')
                                return state.stacks[firstStackIndex].indexOf(_first) === 0 ? result.push(_first) && true : false;
                            else
                                return state.objects[_second].form === 'box' && firstStackIndex === secondStackIndex && state.stacks[firstStackIndex].indexOf(_first) === state.stacks[secondStackIndex].indexOf(_second) + 1 ? result.push(_first) && true : false;
                        } else if (condition.location.relation === 'above') {
                            if (_second === 'floor')
                                return result.push(_first) && true;
                            else
                                return firstStackIndex === secondStackIndex && state.stacks[firstStackIndex].indexOf(_first) > state.stacks[secondStackIndex].indexOf(_second) ? result.push(_first) && true : false;
                        } else if (condition.location.relation === 'under') {
                            return firstStackIndex === secondStackIndex && state.stacks[firstStackIndex].indexOf(_first) < state.stacks[secondStackIndex].indexOf(_second) ? result.push(_first) && true : false;
                        } else {
                            return false;
                        }
                    });
                });
            } else {
                existing.forEach(function(entity) {
                    if ((condition.size === null || condition.size === state.objects[entity].size) &&
                        (condition.color === null || condition.color === state.objects[entity].color) &&
                        (condition.form === 'anyform' || condition.form === state.objects[entity].form)) {
                        result.push(entity);
                    }
                });
            }

            return result;
        }
    }
}
