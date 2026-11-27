import { fileURLToPath } from "node:url";

/** The repo that the prose cases search. `cache/today.md` in it is expired. */
export const proseRepo = fileURLToPath(new URL("../../fixtures/prose-repo", import.meta.url));

/** A text a user could type, and the notes that may match it. An empty list means that no note may match. */
export interface ProseCase {
  query: string;
  expected: string[];
}

/** Short texts that must find a note with other words than its description uses. */
export const shortMatchCases: ProseCase[] = [
  { query: "iterating", expected: ["for-loops"] },
  { query: "go over every item in a list", expected: ["for-loops"] },
  { query: "my branch is behind main", expected: ["rebase"] },
  { query: "fix the merge conflicts", expected: ["rebase"] },
  { query: "describe my changes for git", expected: ["commit-messages"] },
  { query: "ship the website to the live servers", expected: ["deploy"] },
  { query: "add a column to the users table", expected: ["migrations"] },
  { query: "should this function throw?", expected: ["error-handling"] },
  { query: "add a test for this function", expected: ["unit-tests"] },
  { query: "the container does not start on my laptop", expected: ["docker"] },
  { query: "which colour should this button have", expected: ["css-tokens"] },
  { query: "look at this PR before I merge it", expected: ["code-review"] },
  { query: "publish a new version of the library", expected: ["release"] },
  { query: "install the dependencies of a Python script", expected: ["virtual-environments"] },
  { query: "the server is slow, find out why", expected: ["profiling"] },
  { query: "where do I keep the database password", expected: ["secrets"] },
  { query: "convert a timestamp to local time", expected: ["dates"] },
  { query: "match an email address with a pattern", expected: ["regular-expressions"] },
  { query: "blind users cannot use the signup form", expected: ["accessibility"] },
  { query: "give this variable a clearer name", expected: ["naming"] },
  { query: "print what the service does so I can debug it", expected: ["logging"] },
];

/** Short texts that no note in the repo is about. "what day is it" asks for the expired note, so it must not match either. */
export const shortNoMatchCases: ProseCase[] = [
  { query: "what day is it", expected: [] },
  { query: "bake sourdough bread", expected: [] },
  { query: "what is the capital of France", expected: [] },
  { query: "hello", expected: [] },
  { query: "thanks, that looks good", expected: [] },
  { query: "yes", expected: [] },
  { query: "continue", expected: [] },
  { query: "book a flight to Oslo", expected: [] },
  { query: "write a poem about the sea", expected: [] },
  { query: "summarize this file", expected: [] },
  { query: "explain how photosynthesis works", expected: [] },
  { query: "the cat knocked a glass off the table", expected: [] },
];

/** Task prompts as a user types them in an agent session, each about one note. */
export const taskMatchCases: ProseCase[] = [
  {
    query:
      "In src/cart/total.ts the function sums the prices with a while loop and a manual index counter. Rewrite it so that it iterates over the items in a cleaner way, keep the same behaviour, and run the tests afterwards.",
    expected: ["for-loops"],
  },
  {
    query:
      "I opened a PR yesterday, but main moved on and GitHub now says that my branch is out of date and has conflicts in package.json. Bring my branch up to date with main and sort out the conflicts so that CI runs again.",
    expected: ["rebase"],
  },
  {
    query:
      "The payment service needs the Stripe API key in production. Where do I put it so that it is not committed to the repo, and how does the service read it at startup?",
    expected: ["secrets"],
  },
  {
    query:
      "I just wrote parseOrder in src/orders/parse-order.ts. Add tests that cover an empty order, an order with one item and an order with an unknown product id, then run them.",
    expected: ["unit-tests"],
  },
  {
    query:
      "The fix for the checkout bug is merged. Get it out to production today and tell me when the new version is live for customers.",
    expected: ["deploy"],
  },
  {
    query:
      "The /orders endpoint takes four seconds to answer when a user has many orders. Find out where the time goes before you change anything, and show me the slowest functions.",
    expected: ["profiling"],
  },
  {
    query:
      "I am done with the refactor of the cart module. Stage the changes and commit them with a good message that explains why the change was made.",
    expected: ["commit-messages"],
  },
  {
    query:
      "When I run docker compose up, the api container exits right away with code 137. It worked last week. Find out why it does not start on my machine.",
    expected: ["docker"],
  },
  {
    query:
      "We need a new nullable column discount_code on the orders table in Postgres. Write the schema change so that it can run on the live database without downtime.",
    expected: ["migrations"],
  },
  {
    query:
      "The order confirmation email shows the delivery time in UTC, so customers in Norway see the wrong hour. Show it in the customer's own time zone instead.",
    expected: ["dates"],
  },
  {
    query:
      "parseOrder throws an exception when a field is missing, and three callers wrap it in try/catch. Change it so that a missing field is a normal result that the caller checks, not an exception.",
    expected: ["error-handling"],
  },
  {
    query:
      "Review PR 42 before I merge it. Look for bugs, missing tests and anything that is hard to read, and write your comments as a list.",
    expected: ["code-review"],
  },
  {
    query:
      "Version 2.3.0 of the client library is ready. Bump the version, write the changelog entry and publish it to npm.",
    expected: ["release"],
  },
  {
    query:
      "The form accepts phone numbers like 12-34 and +47 123 45 678. Write a pattern that accepts only Norwegian numbers, and add a few examples that must and must not match.",
    expected: ["regular-expressions"],
  },
  {
    query:
      "When a payment fails in production, we cannot see why. Add logging to the payment service so that each failure records the order id, the provider and the error.",
    expected: ["logging"],
  },
  {
    query:
      "A screen reader user says that the checkout button has no label and that the error messages are not read out. Fix the checkout form so that it works with a screen reader.",
    expected: ["accessibility"],
  },
  {
    query:
      "The Python script in tools/report.py needs pandas, but I do not want to install it globally. Set it up so that the script has its own dependencies, and tell me how to run it.",
    expected: ["virtual-environments"],
  },
  {
    query:
      "The function in utils.ts is called doStuff and its arguments are a, b and c. Rename them so that the code says what they do.",
    expected: ["naming"],
  },
  {
    query:
      "The new banner uses #3a7bd5 and 13px of padding. Replace the hard-coded colour and spacing with the values from our design system.",
    expected: ["css-tokens"],
  },
  { query: "how do I iterate over an array and get the index too?", expected: ["for-loops"] },
];

/** Task prompts and replies that no note is about. */
export const taskNoMatchCases: ProseCase[] = [
  {
    query:
      "Write a README for this package that explains what it does and shows one example of how to call it.",
    expected: [],
  },
  {
    query:
      "Add pagination to the GET /products endpoint: accept page and pageSize query parameters, and return the total count in the response.",
    expected: [],
  },
  {
    query: "Translate the onboarding emails into German and keep the placeholders as they are.",
    expected: [],
  },
  {
    query:
      "Explain what this repository does and how its folders are organised. I am new to the project.",
    expected: [],
  },
  {
    query:
      "Create a new React component that shows the avatar of a user, with their initials when there is no picture.",
    expected: [],
  },
  {
    query:
      "Draw a diagram of how the order service talks to the payment service and the stock service.",
    expected: [],
  },
  {
    query: "Summarize the discussion in issue 17 and list the decisions that were made.",
    expected: [],
  },
  {
    query:
      "I need to write a short speech for the wedding of my sister next Saturday. She loves hiking and her husband is a chef. Make it warm and a little funny, about two minutes long.",
    expected: [],
  },
  {
    query:
      "Plan a three-day trip to Rome for two people in April, with a museum each morning and a good place for dinner each evening.",
    expected: [],
  },
  {
    query: "Hi! Before we start, can you tell me what you can help me with in this session?",
    expected: [],
  },
  {
    query: "Make the sidebar collapsible on small screens and remember whether it was open.",
    expected: [],
  },
  {
    query: "Add a search box to the products page that filters the list as the user types.",
    expected: [],
  },
  { query: "ok, go ahead", expected: [] },
  { query: "do it", expected: [] },
  { query: "what does this function do?", expected: [] },
];

/** Written after the threshold was chosen on the cases above, to see how the choice holds on new texts. */
export const laterMatchCases: ProseCase[] = [
  { query: "loop through the keys of an object", expected: ["for-loops"] },
  {
    query: "squash my last three commits and put them on top of the latest main",
    expected: ["rebase"],
  },
  { query: "the build image is huge, can you make the Dockerfile smaller?", expected: ["docker"] },
  {
    query:
      "Our staging deploy failed halfway. Roll out the current main to production once staging is green, and tell me the steps you took.",
    expected: ["deploy"],
  },
  { query: "write a good commit message for these changes", expected: ["commit-messages"] },
  {
    query: "rename the columns of the invoices table without losing data",
    expected: ["migrations"],
  },
  {
    query:
      "The API client throws on every 404, and the callers do not expect that. Make the not-found case a value that they can check instead of an exception.",
    expected: ["error-handling"],
  },
  {
    query:
      "The tests for the cart are flaky and slow. Rewrite them with Vitest so that each test checks one thing.",
    expected: ["unit-tests"],
  },
  { query: "which spacing value should I use between these cards?", expected: ["css-tokens"] },
  {
    query:
      "Give me feedback on this pull request: is the design sound, and is anything missing before it can be merged?",
    expected: ["code-review"],
  },
  { query: "cut a new release of the package", expected: ["release"] },
  {
    query:
      "pip install fails with externally-managed-environment. How do I install requests for my script?",
    expected: ["virtual-environments"],
  },
  {
    query:
      "Memory use of the worker grows all day until it crashes. Find out what holds on to the memory.",
    expected: ["profiling"],
  },
  {
    query: "the AWS credentials are hard-coded in config.ts, move them somewhere safe",
    expected: ["secrets"],
  },
  {
    query: "the report shows yesterday's date for orders placed after 11 pm in Oslo",
    expected: ["dates"],
  },
  {
    query: "extract the version number from strings like v1.2.3-beta",
    expected: ["regular-expressions"],
  },
  { query: "the modal cannot be closed with the keyboard", expected: ["accessibility"] },
  { query: "this function is called handle, what is a better name?", expected: ["naming"] },
  {
    query:
      "We cannot tell which request failed in the logs. Add a request id to every log line of the api service and log the start and end of each request.",
    expected: ["logging"],
  },
  { query: "iterate", expected: ["for-loops"] },
  { query: "iteration", expected: ["for-loops"] },
  { query: "iterating?", expected: ["for-loops"] },
];

/** Written after the threshold was chosen, like `laterMatchCases`. */
export const laterNoMatchCases: ProseCase[] = [
  { query: "what time is it in Tokyo?", expected: [] },
  {
    query:
      "Write a cover letter for a job as a nurse at the city hospital. I have five years of experience in the emergency room.",
    expected: [],
  },
  {
    query: "Add a button to the order page that lets the user download the invoice as a PDF.",
    expected: [],
  },
  { query: "Explain the difference between TCP and UDP.", expected: [] },
  { query: "Implement a function that returns the n-th Fibonacci number.", expected: [] },
  {
    query: "Set up a GitHub Actions workflow that runs the linter on each pull request.",
    expected: [],
  },
  { query: "Convert this JavaScript file to TypeScript and add the types.", expected: [] },
  {
    query: "What are the pros and cons of GraphQL compared to REST for our mobile app?",
    expected: [],
  },
  { query: "make the logo bigger", expected: [] },
  { query: "great, thank you!", expected: [] },
  { query: "no, undo that", expected: [] },
  { query: "/clear", expected: [] },
  {
    query:
      "Read the spec in docs/checkout.md and implement the coupon field on the checkout page. Coupons are validated by the existing /coupons endpoint. Show an inline message when a coupon is invalid, and update the total when it is valid.",
    expected: [],
  },
  { query: "Recommend three science fiction books for a long flight.", expected: [] },
  { query: "Count the lines of code in each folder of this repo.", expected: [] },
];

/** Every case that must find a note. */
export const matchCases: ProseCase[] = [...shortMatchCases, ...taskMatchCases, ...laterMatchCases];

/** Every case that must find no note. */
export const noMatchCases: ProseCase[] = [
  ...shortNoMatchCases,
  ...taskNoMatchCases,
  ...laterNoMatchCases,
];
