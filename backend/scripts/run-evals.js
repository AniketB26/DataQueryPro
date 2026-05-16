/**
 * Lightweight query accuracy eval runner.
 *
 * Default mode validates fixture shape and dialect prompt wiring without
 * calling Gemini. Set RUN_AI_EVALS=1 with GEMINI_API_KEY to run live query
 * generation checks against expected tokens.
 */

const fs = require('fs');
const path = require('path');
const { generateQuery, getSystemPrompt } = require('../src/openai/queryTranslator');

const evalPath = path.join(__dirname, '..', 'evals', 'query-evals.json');
const evals = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const runAiEvals = process.env.RUN_AI_EVALS === '1' && Boolean(process.env.GEMINI_API_KEY);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function includesAll(haystack, needles) {
    const lower = haystack.toLowerCase();
    return needles.every(needle => lower.includes(String(needle).toLowerCase()));
}

function includesNone(haystack, needles) {
    const lower = haystack.toLowerCase();
    return needles.every(needle => !lower.includes(String(needle).toLowerCase()));
}

function validateFixtureShape(testCase) {
    assert(testCase.id, 'Eval case missing id');
    assert(testCase.dbType, `${testCase.id}: missing dbType`);
    assert(testCase.question, `${testCase.id}: missing question`);
    assert(testCase.schema, `${testCase.id}: missing schema`);
    assert(testCase.expected, `${testCase.id}: missing expected checks`);
    assert(Array.isArray(testCase.expected.contains), `${testCase.id}: expected.contains must be an array`);
    assert(Array.isArray(testCase.expected.notContains), `${testCase.id}: expected.notContains must be an array`);
}

function validateDialectPrompt(testCase) {
    const prompt = getSystemPrompt(testCase.dbType);
    const type = testCase.dbType.toLowerCase();

    if (type === 'mysql') {
        assert(prompt.includes('MYSQL DIALECT RULES'), `${testCase.id}: missing MySQL dialect rules`);
    }
    if (type === 'postgresql' || type === 'postgres') {
        assert(prompt.includes('POSTGRESQL DIALECT RULES'), `${testCase.id}: missing PostgreSQL dialect rules`);
    }
    if (type === 'sqlite') {
        assert(prompt.includes('SQLITE DIALECT RULES'), `${testCase.id}: missing SQLite dialect rules`);
    }
}

async function runAiEval(testCase) {
    const result = await generateQuery(
        testCase.question,
        { raw: testCase.schema },
        testCase.dbType,
        []
    );

    assert(result.success, `${testCase.id}: generation failed: ${result.error}`);

    const generated = result.generatedQuery || JSON.stringify(result.query);
    assert(
        includesAll(generated, testCase.expected.contains),
        `${testCase.id}: generated query missing expected tokens.\nGenerated:\n${generated}`
    );
    assert(
        includesNone(generated, testCase.expected.notContains),
        `${testCase.id}: generated query contains forbidden tokens.\nGenerated:\n${generated}`
    );

    return generated;
}

async function main() {
    let passed = 0;

    for (const testCase of evals) {
        validateFixtureShape(testCase);
        validateDialectPrompt(testCase);

        if (runAiEvals) {
            await runAiEval(testCase);
        }

        passed += 1;
        console.log(`PASS ${testCase.id}`);
    }

    if (!runAiEvals) {
        console.log('AI generation checks skipped. Set RUN_AI_EVALS=1 with GEMINI_API_KEY to run live evals.');
    }

    console.log(`\n${passed}/${evals.length} eval fixtures passed.`);
}

main().catch(error => {
    console.error(`\nEval failed: ${error.message}`);
    process.exit(1);
});
