const vldtr = require('./index');
vldtr.run(
    {
        keys: {
            first_name: {
                validatorSchemes: [['name']],
                //sanitizations: [['plusAdd', ['right']], ['dotAdd']],
                sanitizationSchemes: [['dotPlus']],
            },
            email: {
                validatorSchemes: [['emailFree', [2]]],
            },
            dob: {
                optional: true,
                //validatorSchemes: [['dob', ['mm/dd/yyyy']]],
                //sanitize: [['dob', ['mm/dd/yyyy', 'yyyy-mm-dd']]],
            },
            online_offline: {
                keys: {
                    online: {
                        optional: false,
                        /*validatorSchemes: [
                            ['online_offline'],
                        ],*/
                        sanitizations: [
                            ['toInt'],
                        ],
                    },
                    offline: {
                        optional: true,
                        /*validatorSchemes: [
                            ['online_offline'],
                        ],*/
                        sanitize: [
                            ['toInt'],
                        ],
                    },
                },
                validators: [
                    ['validMin', [1]],
                ],
            }
        },
    },
    {
        first_name: 'J',
        email: 'asd',
        dob: 'asd',
    }
).then(async (group) => {
    try {
        const errors = await vldtr.errorsObject(group);
        //console.log(group);
        console.log(errors);
    } catch (error) {
        console.log(error);
    }
});