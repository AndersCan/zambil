# Embedder measurements

`node packages/embed/src/measure/measure-embedders.ts` writes this file. Do not edit it by hand. `README.md` in this folder says which model zambil uses and why.

Machine: unknown (10 cores), 7.2.12-orbstack-00394-gbecdd6130068 arm64, Node v24.22.3, load average 15.4 at the start.

The prose cases are in `src/measure/prose-cases.ts`: 21 texts that must find one note, and 12 texts that must find none. The notes are in `fixtures/prose-repo`.

The columns:

- Top note right: for how many match cases the best note is the expected note.
- No false match at: the lowest score, in steps of 0.01, above the score of every note that must not match, in all cases.
- Found at that score: for how many match cases the best note is the expected note and scores at least that much.
- Cold start: a new Node process loads the code and the model and embeds one query. The fastest of 10 runs. The runs go in rounds, one run of each model per round, so that a busy moment slows each model.
- Load model, One query: the parts of the cold start that the process measured itself.
- 300-word query, 20 descriptions: the time to embed with a loaded model, the fastest of 10 runs.

## Summary

| Model                     | Size  | Top note right | No false match at | Found at that score | Cold start | Load model | One query | 300-word query | 20 descriptions |
| ------------------------- | ----- | -------------- | ----------------- | ------------------- | ---------- | ---------- | --------- | -------------- | --------------- |
| all-minilm-l6-v2          | 23 MB | 20/21          | 0.41              | 9/21                | 144 ms     | 53 ms      | 5 ms      | 21 ms          | 52 ms           |
| all-minilm-l6-v2-fp32     | 90 MB | 20/21          | 0.42              | 9/21                | 165 ms     | 74 ms      | 6 ms      | 54 ms          | 95 ms           |
| paraphrase-minilm-l3-v2   | 17 MB | 13/21          | 0.54              | 2/21                | 122 ms     | 38 ms      | 2 ms      | 7 ms           | 36 ms           |
| bge-small-en-v1.5         | 34 MB | 21/21          | 0.66              | 12/21               | 175 ms     | 82 ms      | 7 ms      | 80 ms          | 126 ms          |
| gte-small                 | 34 MB | 20/21          | 0.83              | 11/21               | 168 ms     | 81 ms      | 4 ms      | 185 ms         | 229 ms          |
| e5-small-v2               | 34 MB | 17/21          | 0.86              | 1/21                | 165 ms     | 81 ms      | 4 ms      | 268 ms         | 284 ms          |
| snowflake-arctic-embed-xs | 23 MB | 19/21          | 0.67              | 1/21                | 125 ms     | 48 ms      | 2 ms      | 59 ms          | 77 ms           |

The whole `zambil search` command, with all-minilm-l6-v2, the index in the cache and the 20 notes of the prose repo, takes 149 ms from the start of the process to its exit. The fastest of 10 runs.

## Scores per case

### all-minilm-l6-v2

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.347     | 0.347          | 0.137            |
| go over every item in a list                  | for-loops            | for-loops            | 0.249     | 0.249          | 0.100            |
| my branch is behind main                      | rebase               | rebase               | 0.587     | 0.587          | 0.229            |
| fix the merge conflicts                       | rebase               | rebase               | 0.533     | 0.533          | 0.208            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.360     | 0.360          | 0.351            |
| ship the website to the live servers          | deploy               | deploy               | 0.451     | 0.451          | 0.281            |
| add a column to the users table               | migrations           | migrations           | 0.194     | 0.194          | 0.123            |
| should this function throw?                   | error-handling       | error-handling       | 0.320     | 0.320          | 0.144            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.483     | 0.483          | 0.343            |
| the container does not start on my laptop     | docker               | docker               | 0.351     | 0.351          | 0.100            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.405     | 0.405          | 0.134            |
| look at this PR before I merge it             | code-review          | rebase               | 0.274     | 0.166          | 0.274            |
| publish a new version of the library          | release              | release              | 0.357     | 0.357          | 0.240            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.340     | 0.340          | 0.227            |
| the server is slow, find out why              | profiling            | profiling            | 0.542     | 0.542          | 0.137            |
| where do I keep the database password         | secrets              | secrets              | 0.542     | 0.542          | 0.402            |
| convert a timestamp to local time             | dates                | dates                | 0.467     | 0.467          | 0.170            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.431     | 0.431          | 0.139            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.211     | 0.211          | 0.082            |
| give this variable a clearer name             | naming               | naming               | 0.490     | 0.490          | 0.173            |
| print what the service does so I can debug it | logging              | logging              | 0.355     | 0.355          | 0.226            |
| what day is it                                | (none)               | dates                | 0.316     | -              | 0.316            |
| bake sourdough bread                          | (none)               | logging              | 0.124     | -              | 0.124            |
| what is the capital of France                 | (none)               | dates                | 0.068     | -              | 0.068            |
| hello                                         | (none)               | regular-expressions  | 0.230     | -              | 0.230            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.158     | -              | 0.158            |
| yes                                           | (none)               | commit-messages      | 0.071     | -              | 0.071            |
| continue                                      | (none)               | rebase               | 0.224     | -              | 0.224            |
| book a flight to Oslo                         | (none)               | dates                | 0.125     | -              | 0.125            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.300     | -              | 0.300            |
| summarize this file                           | (none)               | commit-messages      | 0.322     | -              | 0.322            |
| explain how photosynthesis works              | (none)               | migrations           | 0.230     | -              | 0.230            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.126     | -              | 0.126            |

### all-minilm-l6-v2-fp32

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.327     | 0.327          | 0.135            |
| go over every item in a list                  | for-loops            | for-loops            | 0.234     | 0.234          | 0.079            |
| my branch is behind main                      | rebase               | rebase               | 0.617     | 0.617          | 0.220            |
| fix the merge conflicts                       | rebase               | rebase               | 0.539     | 0.539          | 0.185            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.365     | 0.365          | 0.343            |
| ship the website to the live servers          | deploy               | deploy               | 0.459     | 0.459          | 0.286            |
| add a column to the users table               | migrations           | migrations           | 0.182     | 0.182          | 0.118            |
| should this function throw?                   | error-handling       | error-handling       | 0.306     | 0.306          | 0.144            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.460     | 0.460          | 0.352            |
| the container does not start on my laptop     | docker               | docker               | 0.322     | 0.322          | 0.093            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.416     | 0.416          | 0.128            |
| look at this PR before I merge it             | code-review          | rebase               | 0.282     | 0.186          | 0.282            |
| publish a new version of the library          | release              | release              | 0.335     | 0.335          | 0.253            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.349     | 0.349          | 0.222            |
| the server is slow, find out why              | profiling            | profiling            | 0.549     | 0.549          | 0.134            |
| where do I keep the database password         | secrets              | secrets              | 0.539     | 0.539          | 0.412            |
| convert a timestamp to local time             | dates                | dates                | 0.466     | 0.466          | 0.159            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.436     | 0.436          | 0.142            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.217     | 0.217          | 0.083            |
| give this variable a clearer name             | naming               | naming               | 0.480     | 0.480          | 0.203            |
| print what the service does so I can debug it | logging              | logging              | 0.387     | 0.387          | 0.229            |
| what day is it                                | (none)               | dates                | 0.307     | -              | 0.307            |
| bake sourdough bread                          | (none)               | logging              | 0.130     | -              | 0.130            |
| what is the capital of France                 | (none)               | for-loops            | 0.060     | -              | 0.060            |
| hello                                         | (none)               | regular-expressions  | 0.223     | -              | 0.223            |
| thanks, that looks good                       | (none)               | dates                | 0.143     | -              | 0.143            |
| yes                                           | (none)               | for-loops            | 0.038     | -              | 0.038            |
| continue                                      | (none)               | rebase               | 0.225     | -              | 0.225            |
| book a flight to Oslo                         | (none)               | dates                | 0.107     | -              | 0.107            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.276     | -              | 0.276            |
| summarize this file                           | (none)               | commit-messages      | 0.294     | -              | 0.294            |
| explain how photosynthesis works              | (none)               | migrations           | 0.227     | -              | 0.227            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.110     | -              | 0.110            |

### paraphrase-minilm-l3-v2

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.182     | 0.182          | 0.154            |
| go over every item in a list                  | for-loops            | regular-expressions  | 0.128     | 0.049          | 0.128            |
| my branch is behind main                      | rebase               | rebase               | 0.586     | 0.586          | 0.167            |
| fix the merge conflicts                       | rebase               | rebase               | 0.521     | 0.521          | 0.199            |
| describe my changes for git                   | commit-messages      | rebase               | 0.227     | 0.227          | 0.227            |
| ship the website to the live servers          | deploy               | docker               | 0.320     | 0.316          | 0.320            |
| add a column to the users table               | migrations           | logging              | 0.450     | 0.255          | 0.450            |
| should this function throw?                   | error-handling       | error-handling       | 0.351     | 0.351          | 0.116            |
| add a test for this function                  | unit-tests           | regular-expressions  | 0.537     | 0.507          | 0.537            |
| the container does not start on my laptop     | docker               | docker               | 0.218     | 0.218          | 0.215            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.393     | 0.393          | 0.172            |
| look at this PR before I merge it             | code-review          | css-tokens           | 0.216     | 0.192          | 0.216            |
| publish a new version of the library          | release              | release              | 0.342     | 0.342          | 0.294            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.257     | 0.257          | 0.237            |
| the server is slow, find out why              | profiling            | profiling            | 0.463     | 0.463          | 0.194            |
| where do I keep the database password         | secrets              | secrets              | 0.557     | 0.557          | 0.471            |
| convert a timestamp to local time             | dates                | dates                | 0.473     | 0.473          | 0.189            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.412     | 0.412          | 0.266            |
| blind users cannot use the signup form        | accessibility        | error-handling       | 0.230     | 0.119          | 0.230            |
| give this variable a clearer name             | naming               | naming               | 0.464     | 0.464          | 0.169            |
| print what the service does so I can debug it | logging              | deploy               | 0.321     | 0.303          | 0.321            |
| what day is it                                | (none)               | dates                | 0.358     | -              | 0.358            |
| bake sourdough bread                          | (none)               | deploy               | 0.155     | -              | 0.155            |
| what is the capital of France                 | (none)               | css-tokens           | 0.169     | -              | 0.169            |
| hello                                         | (none)               | release              | 0.170     | -              | 0.170            |
| thanks, that looks good                       | (none)               | regular-expressions  | 0.163     | -              | 0.163            |
| yes                                           | (none)               | css-tokens           | 0.087     | -              | 0.087            |
| continue                                      | (none)               | rebase               | 0.171     | -              | 0.171            |
| book a flight to Oslo                         | (none)               | accessibility        | 0.110     | -              | 0.110            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.272     | -              | 0.272            |
| summarize this file                           | (none)               | commit-messages      | 0.266     | -              | 0.266            |
| explain how photosynthesis works              | (none)               | virtual-environments | 0.140     | -              | 0.140            |
| the cat knocked a glass off the table         | (none)               | error-handling       | 0.142     | -              | 0.142            |

### bge-small-en-v1.5

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.687     | 0.687          | 0.619            |
| go over every item in a list                  | for-loops            | for-loops            | 0.594     | 0.594          | 0.543            |
| my branch is behind main                      | rebase               | rebase               | 0.697     | 0.697          | 0.581            |
| fix the merge conflicts                       | rebase               | rebase               | 0.780     | 0.780          | 0.591            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.672     | 0.672          | 0.659            |
| ship the website to the live servers          | deploy               | deploy               | 0.693     | 0.693          | 0.621            |
| add a column to the users table               | migrations           | migrations           | 0.599     | 0.599          | 0.576            |
| should this function throw?                   | error-handling       | error-handling       | 0.672     | 0.672          | 0.608            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.631     | 0.631          | 0.585            |
| the container does not start on my laptop     | docker               | docker               | 0.647     | 0.647          | 0.563            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.704     | 0.704          | 0.535            |
| look at this PR before I merge it             | code-review          | code-review          | 0.576     | 0.576          | 0.542            |
| publish a new version of the library          | release              | release              | 0.615     | 0.615          | 0.614            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.623     | 0.623          | 0.593            |
| the server is slow, find out why              | profiling            | profiling            | 0.699     | 0.699          | 0.533            |
| where do I keep the database password         | secrets              | secrets              | 0.756     | 0.756          | 0.632            |
| convert a timestamp to local time             | dates                | dates                | 0.695     | 0.695          | 0.549            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.685     | 0.685          | 0.604            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.512     | 0.512          | 0.465            |
| give this variable a clearer name             | naming               | naming               | 0.703     | 0.703          | 0.593            |
| print what the service does so I can debug it | logging              | logging              | 0.649     | 0.649          | 0.617            |
| what day is it                                | (none)               | dates                | 0.587     | -              | 0.587            |
| bake sourdough bread                          | (none)               | logging              | 0.464     | -              | 0.464            |
| what is the capital of France                 | (none)               | css-tokens           | 0.455     | -              | 0.455            |
| hello                                         | (none)               | secrets              | 0.543     | -              | 0.543            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.550     | -              | 0.550            |
| yes                                           | (none)               | css-tokens           | 0.474     | -              | 0.474            |
| continue                                      | (none)               | css-tokens           | 0.539     | -              | 0.539            |
| book a flight to Oslo                         | (none)               | migrations           | 0.471     | -              | 0.471            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.540     | -              | 0.540            |
| summarize this file                           | (none)               | commit-messages      | 0.628     | -              | 0.628            |
| explain how photosynthesis works              | (none)               | commit-messages      | 0.495     | -              | 0.495            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.384     | -              | 0.384            |

### gte-small

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.826     | 0.826          | 0.787            |
| go over every item in a list                  | for-loops            | for-loops            | 0.797     | 0.797          | 0.790            |
| my branch is behind main                      | rebase               | rebase               | 0.876     | 0.876          | 0.800            |
| fix the merge conflicts                       | rebase               | rebase               | 0.881     | 0.881          | 0.784            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.838     | 0.838          | 0.821            |
| ship the website to the live servers          | deploy               | deploy               | 0.839     | 0.839          | 0.794            |
| add a column to the users table               | migrations           | migrations           | 0.787     | 0.787          | 0.787            |
| should this function throw?                   | error-handling       | error-handling       | 0.824     | 0.824          | 0.786            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.825     | 0.825          | 0.798            |
| the container does not start on my laptop     | docker               | docker               | 0.815     | 0.815          | 0.774            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.832     | 0.832          | 0.764            |
| look at this PR before I merge it             | code-review          | rebase               | 0.815     | 0.782          | 0.815            |
| publish a new version of the library          | release              | release              | 0.795     | 0.795          | 0.793            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.816     | 0.816          | 0.789            |
| the server is slow, find out why              | profiling            | profiling            | 0.868     | 0.868          | 0.767            |
| where do I keep the database password         | secrets              | secrets              | 0.885     | 0.885          | 0.811            |
| convert a timestamp to local time             | dates                | dates                | 0.849     | 0.849          | 0.768            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.839     | 0.839          | 0.791            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.799     | 0.799          | 0.770            |
| give this variable a clearer name             | naming               | naming               | 0.863     | 0.863          | 0.786            |
| print what the service does so I can debug it | logging              | logging              | 0.843     | 0.843          | 0.795            |
| what day is it                                | (none)               | dates                | 0.796     | -              | 0.796            |
| bake sourdough bread                          | (none)               | secrets              | 0.732     | -              | 0.732            |
| what is the capital of France                 | (none)               | secrets              | 0.722     | -              | 0.722            |
| hello                                         | (none)               | secrets              | 0.784     | -              | 0.784            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.802     | -              | 0.802            |
| yes                                           | (none)               | secrets              | 0.780     | -              | 0.780            |
| continue                                      | (none)               | commit-messages      | 0.784     | -              | 0.784            |
| book a flight to Oslo                         | (none)               | secrets              | 0.722     | -              | 0.722            |
| write a poem about the sea                    | (none)               | docker               | 0.754     | -              | 0.754            |
| summarize this file                           | (none)               | naming               | 0.817     | -              | 0.817            |
| explain how photosynthesis works              | (none)               | virtual-environments | 0.748     | -              | 0.748            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.701     | -              | 0.701            |

### e5-small-v2

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | dates                | 0.804     | 0.803          | 0.804            |
| go over every item in a list                  | for-loops            | regular-expressions  | 0.809     | 0.791          | 0.809            |
| my branch is behind main                      | rebase               | rebase               | 0.835     | 0.835          | 0.781            |
| fix the merge conflicts                       | rebase               | rebase               | 0.849     | 0.849          | 0.784            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.838     | 0.838          | 0.820            |
| ship the website to the live servers          | deploy               | deploy               | 0.803     | 0.803          | 0.797            |
| add a column to the users table               | migrations           | release              | 0.815     | 0.798          | 0.815            |
| should this function throw?                   | error-handling       | error-handling       | 0.819     | 0.819          | 0.813            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.844     | 0.844          | 0.843            |
| the container does not start on my laptop     | docker               | docker               | 0.819     | 0.819          | 0.807            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.834     | 0.834          | 0.799            |
| look at this PR before I merge it             | code-review          | code-review          | 0.827     | 0.827          | 0.806            |
| publish a new version of the library          | release              | release              | 0.809     | 0.809          | 0.782            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.821     | 0.821          | 0.818            |
| the server is slow, find out why              | profiling            | profiling            | 0.851     | 0.851          | 0.789            |
| where do I keep the database password         | secrets              | secrets              | 0.873     | 0.873          | 0.828            |
| convert a timestamp to local time             | dates                | dates                | 0.851     | 0.851          | 0.803            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.829     | 0.829          | 0.812            |
| blind users cannot use the signup form        | accessibility        | release              | 0.782     | 0.770          | 0.782            |
| give this variable a clearer name             | naming               | naming               | 0.848     | 0.848          | 0.812            |
| print what the service does so I can debug it | logging              | logging              | 0.818     | 0.818          | 0.806            |
| what day is it                                | (none)               | dates                | 0.820     | -              | 0.820            |
| bake sourdough bread                          | (none)               | for-loops            | 0.766     | -              | 0.766            |
| what is the capital of France                 | (none)               | virtual-environments | 0.742     | -              | 0.742            |
| hello                                         | (none)               | css-tokens           | 0.780     | -              | 0.780            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.758     | -              | 0.758            |
| yes                                           | (none)               | css-tokens           | 0.773     | -              | 0.773            |
| continue                                      | (none)               | for-loops            | 0.794     | -              | 0.794            |
| book a flight to Oslo                         | (none)               | dates                | 0.727     | -              | 0.727            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.773     | -              | 0.773            |
| summarize this file                           | (none)               | naming               | 0.855     | -              | 0.855            |
| explain how photosynthesis works              | (none)               | virtual-environments | 0.804     | -              | 0.804            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.718     | -              | 0.718            |

### snowflake-arctic-embed-xs

| Query                                         | Expected             | Top note            | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | ------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops           | 0.517     | 0.517          | 0.503            |
| go over every item in a list                  | for-loops            | for-loops           | 0.538     | 0.538          | 0.529            |
| my branch is behind main                      | rebase               | rebase              | 0.613     | 0.613          | 0.501            |
| fix the merge conflicts                       | rebase               | rebase              | 0.652     | 0.652          | 0.475            |
| describe my changes for git                   | commit-messages      | commit-messages     | 0.657     | 0.657          | 0.622            |
| ship the website to the live servers          | deploy               | deploy              | 0.598     | 0.598          | 0.553            |
| add a column to the users table               | migrations           | migrations          | 0.578     | 0.578          | 0.558            |
| should this function throw?                   | error-handling       | error-handling      | 0.616     | 0.616          | 0.536            |
| add a test for this function                  | unit-tests           | unit-tests          | 0.608     | 0.608          | 0.576            |
| the container does not start on my laptop     | docker               | docker              | 0.626     | 0.626          | 0.578            |
| which colour should this button have          | css-tokens           | css-tokens          | 0.592     | 0.592          | 0.488            |
| look at this PR before I merge it             | code-review          | code-review         | 0.575     | 0.575          | 0.534            |
| publish a new version of the library          | release              | migrations          | 0.558     | 0.551          | 0.558            |
| install the dependencies of a Python script   | virtual-environments | naming              | 0.668     | 0.662          | 0.668            |
| the server is slow, find out why              | profiling            | profiling           | 0.634     | 0.634          | 0.534            |
| where do I keep the database password         | secrets              | secrets             | 0.693     | 0.693          | 0.643            |
| convert a timestamp to local time             | dates                | dates               | 0.597     | 0.597          | 0.496            |
| match an email address with a pattern         | regular-expressions  | regular-expressions | 0.645     | 0.645          | 0.536            |
| blind users cannot use the signup form        | accessibility        | accessibility       | 0.533     | 0.533          | 0.519            |
| give this variable a clearer name             | naming               | naming              | 0.630     | 0.630          | 0.528            |
| print what the service does so I can debug it | logging              | logging             | 0.607     | 0.607          | 0.564            |
| what day is it                                | (none)               | dates               | 0.548     | -              | 0.548            |
| bake sourdough bread                          | (none)               | error-handling      | 0.443     | -              | 0.443            |
| what is the capital of France                 | (none)               | naming              | 0.492     | -              | 0.492            |
| hello                                         | (none)               | accessibility       | 0.537     | -              | 0.537            |
| thanks, that looks good                       | (none)               | code-review         | 0.501     | -              | 0.501            |
| yes                                           | (none)               | accessibility       | 0.503     | -              | 0.503            |
| continue                                      | (none)               | code-review         | 0.498     | -              | 0.498            |
| book a flight to Oslo                         | (none)               | migrations          | 0.484     | -              | 0.484            |
| write a poem about the sea                    | (none)               | commit-messages     | 0.561     | -              | 0.561            |
| summarize this file                           | (none)               | naming              | 0.550     | -              | 0.550            |
| explain how photosynthesis works              | (none)               | dates               | 0.524     | -              | 0.524            |
| the cat knocked a glass off the table         | (none)               | error-handling      | 0.467     | -              | 0.467            |
