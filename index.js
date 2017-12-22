"use strict";

let cfg = {
    validators: {
        range: (value, min, max) => {
            return value.length >= min && value.length <= max;
        },
        emailValid: (value) => {
            return true;
        },
        emailAvailable: (value, applicationId) => {
            return true;
        },
        emailNotSpam: (value) => {
            return true;
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
        emailFree: (value, applicationId) => {
            return [
                ['emailValid'],
                ['emailNotSpam'],
                ['emailAvailable', [applicationId]]
            ];
        }
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
exports.configure = function (config) {
    cfg = merge(cfg, config);
};

/**
 * Run as middleware
 * @param group
 * @param location
 * @returns {Function}
 */
exports.mw = function (group, location) {
    return async function (req, res, next) {
        req.vldtr = await this.run(group, req[location]);
        next();
    }
};

/**
 * Validate & sanitize group object
 *
 * @param group
 * @param values
 * @returns {Promise<*>}
 */
exports.run = async function (group, values) {
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
                Object.assign(group.keys[key], await processKey(group.keys[key], value));
            }
        }
    }
    // Process group
    Object.assign(group, await processGroup(group));
    // Return
    return group;
};

/**
 * Process key validators, schemes & sanitize
 *
 * @param key
 * @param value
 * @returns {Promise.<{}>}
 */
async function processKey(key, value) {
    let valueSanitized = value;
    let errors = {};
    // If is set value
    if (typeof value !== 'undefined') {
        // Validators
        if (typeof key['validators'] !== 'undefined') {
            Object.assign(errors, await validators(key['validators'], value));
        }
        // Validator Schemes
        if (typeof key['validatorSchemes'] !== 'undefined') {
            Object.assign(errors, await validatorSchemes(key['validatorSchemes'], value));
        }
        // Sanitizations
        if (typeof key['sanitizations'] !== 'undefined') {
            valueSanitized = await sanitizations(key['sanitizations'], value);
        }
        // Sanitization Schemes
        if (typeof key['sanitizationSchemes'] !== 'undefined') {
            valueSanitized = await sanitizationSchemes(key['sanitizationSchemes'], value);
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
async function processGroup(group) {
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
        errors = await validators(group['validators'], group);
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
async function validators(validators, param) {
    const errors = [];
    for (const validator of validators) {
        const name = validator[0];
        const options = typeof validator[1] !== 'undefined' ? validator[1] : [];
        // Check if validator is defined
        if (typeof cfg.validators[name] !== 'undefined') {
            if (await cfg.validators[name](param, ...options) === false) {
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
async function validatorSchemes(schemes, param) {
    const errors = [];
    for (const scheme of schemes) {
        const name = scheme[0];
        const options = typeof scheme[1] !== 'undefined' ? scheme[1] : [];
        // Check if scheme is defined
        if (typeof cfg.validatorSchemes[name] !== 'undefined') {
            const validatorErrors = await validators(cfg.validatorSchemes[name](param, ...options), param);
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
async function sanitizations(sanitizations, value) {
    for (const sanitization of sanitizations) {
        const name = sanitization[0];
        const options = typeof sanitization[1] !== 'undefined' ? sanitization[1] : [];
        // Check if validator is defined
        if (typeof cfg.sanitizations[name] !== 'undefined') {
            value = await cfg.sanitizations[name](value, ...options)
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
async function sanitizationSchemes(schemes, value) {
    for (const scheme of schemes) {
        const name = scheme[0];
        const options = typeof scheme[1] !== 'undefined' ? scheme[1] : [];
        // Check if scheme is defined
        if (typeof cfg.sanitizationSchemes[name] !== 'undefined') {
            value = await sanitizations(cfg.sanitizationSchemes[name](value, ...options), value);
        } else {
            throw 'Sanitization scheme ' + name + ' does not exist.';
        }
    }
    return value;
}

/**
 * Gets only those errors where their group validation fails
 *
 * @param group
 * @param key
 * @returns {Promise<{}>}
 */
exports.errorsObject = async function (group, key = '*') {
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
};