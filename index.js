"use strict";

class Vldtr {
    constructor(config) {
        this.cfg = {
            validators: {
                range: (value, min, max) => {
                    return value.length >= min && value.length <= max;
                },
                between: (value, min, max) => {
                    const number = parseFloat(value);
                    return number >= min && number <= max;
                },
                isNumber: (value, strict) => {
                    let number = value;
                    if (!strict) {
                        number = parseFloat(value);
                    }
                    return !isNaN(number);
                },
                isNumberPositive: (value, strict) => {
                    let number = value;
                    if (!strict) {
                        number = parseFloat(value);
                    }
                    return !isNaN(number) && parseFloat(number) > 0;
                },
                isTime: (value) => {
                    let valid = true;
                    const numbers = value.split(':');
                    if (numbers.length !== 3) valid = false;
                    numbers.forEach((number, index) => {
                        if (isNaN(number)) valid = false;
                        switch (index) {
                            case 0: {
                                if (number < 0 || number > 24) valid = false;
                                break;
                            }
                            default: {
                                if (number < 0 || number > 60) valid = false;
                                break;                                
                            }
                        }
                    });
                    return valid;
                },
                isDate: (value) => {
                    const date = new Date(value);
                    return !isNaN(date.getTime());
                },
                validMin: (group, min) => {
                    for (const key in group.keys) {
                        if (group.keys.hasOwnProperty(key)) {
                            if (group.keys[key]['valid'] === true) {
                                min--;
                            }
                            if (min < 1) {
                                return true;
                            }
                        }
                    }
                    return false;
                },
            },
            validatorSchemes: {
                name: (value) => {
                    return [['range', [2, 35]]];
                },
                password: (value) => {
                    return [['range', [6, 50]]];
                },
                text: (value) => {
                    return [['range', [1, 150]]];
                },
                boolean: (value) => {
                    return [
                        ['isNumber'],
                        ['between', [0, 1]],
                    ];
                },
            },
            sanitizations: {
                trim: (value) => {
                    return value;
                },
                dotAdd: (value) => {
                    return value + '.';
                },
                plusAdd: (value, side) => {
                    return (side === 'left' ? '+' : '') + value + (side === 'right' ? '+' : '');
                },
            },
            sanitizationSchemes: {
                dotPlus: (value, side) => {
                    return [
                        ['plusAdd', ['left']],
                        ['dotAdd'],
                    ];
                },
            },
        };
        if (config) {
            const configKeys = Object.keys(config);
            configKeys.forEach((key) => {
                Object.assign(this.cfg[key], config[key]);    
            });
        }
    }

    /**
     * Process key validators, schemes & sanitize
     *
     * @param key
     * @param value
     * @returns {Promise.<{}>}
     */
    async processKey(key, value) {
        let valueSanitized = value;
        let errors = {};
        // If is set value
        if (typeof value !== 'undefined') {
            // Validators
            if (typeof key['validators'] !== 'undefined') {
                Object.assign(errors, await this.validators(key['validators'], value));
            }
            // Validator Schemes
            if (typeof key['validatorSchemes'] !== 'undefined') {
                Object.assign(errors, await this.validatorSchemes(key['validatorSchemes'], value));
            }
            // Sanitizations
            if (typeof key['sanitizations'] !== 'undefined') {
                valueSanitized = await this.sanitizations(key['sanitizations'], value);
            }
            // Sanitization Schemes
            if (typeof key['sanitizationSchemes'] !== 'undefined') {
                valueSanitized = await this.sanitizationSchemes(key['sanitizationSchemes'], value);
            }
        }
        // If is not set and IS NOT optional
        else if (typeof key['optional'] === 'undefined' || key['optional'] !== true) {
            errors = {
                'optional': [],
            };
        }
        return {
            errors: errors,
            valid: Object.keys(errors).length === 0,
            value: value,
            valueSanitized: valueSanitized,
        };
    }

    /**
     * Process group
     *
     * @param group
     * @returns {Promise.<*>}
     */
    async processGroup(group) {
        let errors = {};
        let valid = true;
        // Check if first child keys have errors
        for (const key in group.keys) {
            if (group.keys.hasOwnProperty(key)) {
                if (group.keys[key]['valid'] === false) {
                    valid = false;
                    break;
                }
            }
        }
        if (typeof group['validators'] !== 'undefined') {
            errors = await this.validators(group['validators'], group);
            valid = Object.keys(errors).length === 0;
        }
        return {
            errors: errors,
            valid: valid,
        };
    }

    /**
     * Loop through validators
     *
     * @param validators
     * @param param group or value
     * @returns {Promise.<Array>}
     */
    async validators(validators, param) {
        const errors = [];
        for (const validator of validators) {
            const name = validator[0];
            const options = typeof validator[1] !== 'undefined' ? validator[1] : [];
            // Check if validator is defined
            if (typeof this.cfg.validators[name] !== 'undefined') {
                if (await this.cfg.validators[name](param, ...options) === false) {
                    errors[name] = options;
                }
            } else {
                throw 'Validator ' + name + ' does not exist.';
            }
        }
        return errors;
    }

    /**
     * Loop through validator schemes
     *
     * @param schemes
     * @param param group or value
     */
    async validatorSchemes(schemes, param) {
        const errors = [];
        for (const scheme of schemes) {
            const name = scheme[0];
            const options = typeof scheme[1] !== 'undefined' ? scheme[1] : [];
            // Check if scheme is defined
            if (typeof this.cfg.validatorSchemes[name] !== 'undefined') {
                const validatorErrors = await this.validators(this.cfg.validatorSchemes[name](param, ...options), param);
                if (Object.keys(validatorErrors).length > 0) {
                    Object.assign(errors, validatorErrors);
                }
            } else {
                throw 'Validator scheme ' + name + ' does not exist.';
            }
        }
        return errors;
    }

    /**
     * Loop through sanitizations
     *
     * @param sanitizations
     * @param value
     */
    async sanitizations(sanitizations, value) {
        for (const sanitization of sanitizations) {
            const name = sanitization[0];
            const options = typeof sanitization[1] !== 'undefined' ? sanitization[1] : [];
            // Check if validator is defined
            if (typeof this.cfg.sanitizations[name] !== 'undefined') {
                value = await this.cfg.sanitizations[name](value, ...options)
            } else {
                throw 'Sanitization ' + name + ' does not exist.';
            }
        }
        return value;
    }

    /**
     * Loop through sanitization schemes
     *
     * @param schemes
     * @param value
     */
    async sanitizationSchemes(schemes, value) {
        for (const scheme of schemes) {
            const name = scheme[0];
            const options = typeof scheme[1] !== 'undefined' ? scheme[1] : [];
            // Check if scheme is defined
            if (typeof this.cfg.sanitizationSchemes[name] !== 'undefined') {
                value = await this.sanitizations(this.cfg.sanitizationSchemes[name](value, ...options), value);
            } else {
                throw 'Sanitization scheme ' + name + ' does not exist.';
            }
        }
        return value;
    }
    /**
     * Run as middleware
     * @param group
     * @param location
     * @returns {Function}
     */
    mw(group, location, throwError) {
        return async (req, res, next) => {
            req.vldtr = await this.run(group, req[location]);
            const errors = await this.errorsObject(req.vldtr);
            if (throwError && Object.keys(errors).length > 0) {
                throw {
                    statusCode: 400,
                    key: 'validation',
                    response: errors,
                    error: errors,
                };
            }
            next();
        };
    }

    /**
     * Validate & sanitize group object
     *
     * @param group
     * @param values
     * @returns {Promise<*>}
     */
    async run(group, values) {
        for (const key in group.keys) {
            if (group.keys.hasOwnProperty(key)) {
                // Group
                if (typeof group.keys[key]['keys'] !== 'undefined') {
                    group.keys[key] = await this.run(group.keys[key], values);
                }
                // Key
                else {
                    // Process key
                    const value = typeof values[key] !== 'undefined' ? values[key] : undefined;
                    Object.assign(group.keys[key], await this.processKey(group.keys[key], value));
                }
            }
        }
        // Process group
        Object.assign(group, await this.processGroup(group));
        // Return
        return group;
    }

    /**
     * Gets only those errors where their group validation fails
     *
     * @param group
     * @param key
     * @returns {Promise<{}>}
     */
    async errorsObject(group, key = '*') {
        let errors = {};
        // Go deep only if group is NOT valid
        if (group['valid'] === false) {
            if (Object.keys(group['errors']).length > 0) {
                errors[key] = group['errors'];
            }
            for (const key in group.keys) {
                if (group.keys.hasOwnProperty(key)) {
                    // Group
                    if (typeof group.keys[key]['keys'] !== 'undefined') {
                        Object.assign(errors, await this.errorsObject(group.keys[key], key));
                    }
                    // Key
                    else {
                        if (group.keys[key]['valid'] === false) {
                            errors[key] = group.keys[key]['errors'];
                        }
                    }
                }
            }
        }

        return errors;
    }   
}

module.exports = (config) => new Vldtr(config);