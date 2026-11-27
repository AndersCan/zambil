# Embedder measurements

`node packages/embed/src/measure/measure-embedders.ts` writes this file. Do not edit it by hand. `README.md` in this folder says which model zambil uses and why.

Machine: unknown (10 cores), 7.2.12-orbstack-00394-gbecdd6130068 arm64, Node v24.22.3, load average 17.2 at the start.

The prose cases are in `src/measure/prose-cases.ts`: 21 texts that must find one note, and 12 texts that must find none. The notes are in `fixtures/prose-repo`.

The columns:

- Top note right: for how many match cases the best note is the expected note.
- No false match at: the lowest score, in steps of 0.01, above the score of every note that must not match, in all cases.
- Found at that score: for how many match cases the best note is the expected note and scores at least that much.
- Cold start: a new Node process loads the code and the model and embeds one query. The fastest of 10 runs.
- Load model, One query: the parts of the cold start that the process measured itself.
- 300-word query, 20 descriptions: the time to embed with a loaded model, the fastest of 10 runs.

## Summary

| Model                     | Size  | Top note right | No false match at | Found at that score | Cold start | Load model | One query | 300-word query | 20 descriptions |
| ------------------------- | ----- | -------------- | ----------------- | ------------------- | ---------- | ---------- | --------- | -------------- | --------------- |
| all-minilm-l6-v2          | 23 MB | 20/21          | 0.42              | 9/21                | 124 ms     | 50 ms      | 2 ms      | 20 ms          | 32 ms           |
| all-minilm-l6-v2-fp32     | 90 MB | 20/21          | 0.42              | 9/21                | 173 ms     | 75 ms      | 4 ms      | 50 ms          | 91 ms           |
| paraphrase-minilm-l3-v2   | 17 MB | 13/21          | 0.55              | 2/21                | 154 ms     | 54 ms      | 2 ms      | 6 ms           | 18 ms           |
| bge-small-en-v1.5         | 34 MB | 20/21          | 0.66              | 13/21               | 189 ms     | 90 ms      | 6 ms      | 84 ms          | 120 ms          |
| gte-small                 | 34 MB | 19/21          | 0.83              | 11/21               | 435 ms     | 238 ms     | 11 ms     | 297 ms         | 226 ms          |
| e5-small-v2               | 34 MB | 17/21          | 0.86              | 1/21                | 434 ms     | 224 ms     | 11 ms     | 223 ms         | 187 ms          |
| snowflake-arctic-embed-xs | 23 MB | 19/21          | 0.67              | 1/21                | 276 ms     | 92 ms      | 6 ms      | 112 ms         | 60 ms           |

The whole `zambil search` command, with all-minilm-l6-v2, the index in the cache and the 20 notes of the prose repo, takes 365 ms from the start of the process to its exit. The fastest of 10 runs.

## Scores per case

### all-minilm-l6-v2

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.369     | 0.369          | 0.129            |
| go over every item in a list                  | for-loops            | for-loops            | 0.259     | 0.259          | 0.102            |
| my branch is behind main                      | rebase               | rebase               | 0.604     | 0.604          | 0.226            |
| fix the merge conflicts                       | rebase               | rebase               | 0.529     | 0.529          | 0.211            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.373     | 0.373          | 0.340            |
| ship the website to the live servers          | deploy               | deploy               | 0.445     | 0.445          | 0.273            |
| add a column to the users table               | migrations           | migrations           | 0.208     | 0.208          | 0.117            |
| should this function throw?                   | error-handling       | error-handling       | 0.322     | 0.322          | 0.168            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.469     | 0.469          | 0.348            |
| the container does not start on my laptop     | docker               | docker               | 0.336     | 0.336          | 0.105            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.402     | 0.402          | 0.138            |
| look at this PR before I merge it             | code-review          | rebase               | 0.269     | 0.165          | 0.269            |
| publish a new version of the library          | release              | release              | 0.355     | 0.355          | 0.244            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.334     | 0.334          | 0.229            |
| the server is slow, find out why              | profiling            | profiling            | 0.522     | 0.522          | 0.125            |
| where do I keep the database password         | secrets              | secrets              | 0.540     | 0.540          | 0.415            |
| convert a timestamp to local time             | dates                | dates                | 0.449     | 0.449          | 0.178            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.437     | 0.437          | 0.142            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.215     | 0.215          | 0.080            |
| give this variable a clearer name             | naming               | naming               | 0.482     | 0.482          | 0.213            |
| print what the service does so I can debug it | logging              | logging              | 0.359     | 0.359          | 0.236            |
| what day is it                                | (none)               | dates                | 0.295     | -              | 0.295            |
| bake sourdough bread                          | (none)               | logging              | 0.130     | -              | 0.130            |
| what is the capital of France                 | (none)               | dates                | 0.064     | -              | 0.064            |
| hello                                         | (none)               | regular-expressions  | 0.230     | -              | 0.230            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.155     | -              | 0.155            |
| yes                                           | (none)               | commit-messages      | 0.072     | -              | 0.072            |
| continue                                      | (none)               | commit-messages      | 0.230     | -              | 0.230            |
| book a flight to Oslo                         | (none)               | dates                | 0.125     | -              | 0.125            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.297     | -              | 0.297            |
| summarize this file                           | (none)               | commit-messages      | 0.328     | -              | 0.328            |
| explain how photosynthesis works              | (none)               | migrations           | 0.239     | -              | 0.239            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.128     | -              | 0.128            |

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
| iterating                                     | for-loops            | for-loops            | 0.192     | 0.192          | 0.160            |
| go over every item in a list                  | for-loops            | rebase               | 0.133     | 0.047          | 0.133            |
| my branch is behind main                      | rebase               | rebase               | 0.575     | 0.575          | 0.178            |
| fix the merge conflicts                       | rebase               | rebase               | 0.532     | 0.532          | 0.195            |
| describe my changes for git                   | commit-messages      | rebase               | 0.226     | 0.221          | 0.226            |
| ship the website to the live servers          | deploy               | docker               | 0.320     | 0.314          | 0.320            |
| add a column to the users table               | migrations           | logging              | 0.450     | 0.273          | 0.450            |
| should this function throw?                   | error-handling       | error-handling       | 0.376     | 0.376          | 0.111            |
| add a test for this function                  | unit-tests           | regular-expressions  | 0.543     | 0.502          | 0.543            |
| the container does not start on my laptop     | docker               | docker               | 0.221     | 0.221          | 0.215            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.386     | 0.386          | 0.172            |
| look at this PR before I merge it             | code-review          | css-tokens           | 0.223     | 0.193          | 0.223            |
| publish a new version of the library          | release              | release              | 0.344     | 0.344          | 0.290            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.258     | 0.258          | 0.228            |
| the server is slow, find out why              | profiling            | profiling            | 0.470     | 0.470          | 0.190            |
| where do I keep the database password         | secrets              | secrets              | 0.561     | 0.561          | 0.477            |
| convert a timestamp to local time             | dates                | dates                | 0.481     | 0.481          | 0.188            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.411     | 0.411          | 0.260            |
| blind users cannot use the signup form        | accessibility        | error-handling       | 0.220     | 0.118          | 0.220            |
| give this variable a clearer name             | naming               | naming               | 0.453     | 0.453          | 0.171            |
| print what the service does so I can debug it | logging              | deploy               | 0.316     | 0.301          | 0.316            |
| what day is it                                | (none)               | dates                | 0.363     | -              | 0.363            |
| bake sourdough bread                          | (none)               | logging              | 0.159     | -              | 0.159            |
| what is the capital of France                 | (none)               | css-tokens           | 0.168     | -              | 0.168            |
| hello                                         | (none)               | release              | 0.172     | -              | 0.172            |
| thanks, that looks good                       | (none)               | regular-expressions  | 0.152     | -              | 0.152            |
| yes                                           | (none)               | css-tokens           | 0.081     | -              | 0.081            |
| continue                                      | (none)               | rebase               | 0.180     | -              | 0.180            |
| book a flight to Oslo                         | (none)               | accessibility        | 0.108     | -              | 0.108            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.263     | -              | 0.263            |
| summarize this file                           | (none)               | commit-messages      | 0.267     | -              | 0.267            |
| explain how photosynthesis works              | (none)               | virtual-environments | 0.141     | -              | 0.141            |
| the cat knocked a glass off the table         | (none)               | error-handling       | 0.135     | -              | 0.135            |

### bge-small-en-v1.5

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.686     | 0.686          | 0.620            |
| go over every item in a list                  | for-loops            | for-loops            | 0.593     | 0.593          | 0.550            |
| my branch is behind main                      | rebase               | rebase               | 0.709     | 0.709          | 0.576            |
| fix the merge conflicts                       | rebase               | rebase               | 0.776     | 0.776          | 0.587            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.672     | 0.672          | 0.654            |
| ship the website to the live servers          | deploy               | deploy               | 0.699     | 0.699          | 0.626            |
| add a column to the users table               | migrations           | migrations           | 0.598     | 0.598          | 0.578            |
| should this function throw?                   | error-handling       | error-handling       | 0.672     | 0.672          | 0.612            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.628     | 0.628          | 0.586            |
| the container does not start on my laptop     | docker               | docker               | 0.649     | 0.649          | 0.558            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.708     | 0.708          | 0.535            |
| look at this PR before I merge it             | code-review          | code-review          | 0.570     | 0.570          | 0.542            |
| publish a new version of the library          | release              | migrations           | 0.616     | 0.615          | 0.616            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.622     | 0.622          | 0.590            |
| the server is slow, find out why              | profiling            | profiling            | 0.701     | 0.701          | 0.537            |
| where do I keep the database password         | secrets              | secrets              | 0.756     | 0.756          | 0.634            |
| convert a timestamp to local time             | dates                | dates                | 0.690     | 0.690          | 0.547            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.691     | 0.691          | 0.605            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.503     | 0.503          | 0.469            |
| give this variable a clearer name             | naming               | naming               | 0.703     | 0.703          | 0.597            |
| print what the service does so I can debug it | logging              | logging              | 0.663     | 0.663          | 0.616            |
| what day is it                                | (none)               | dates                | 0.591     | -              | 0.591            |
| bake sourdough bread                          | (none)               | logging              | 0.465     | -              | 0.465            |
| what is the capital of France                 | (none)               | css-tokens           | 0.460     | -              | 0.460            |
| hello                                         | (none)               | secrets              | 0.540     | -              | 0.540            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.550     | -              | 0.550            |
| yes                                           | (none)               | css-tokens           | 0.473     | -              | 0.473            |
| continue                                      | (none)               | css-tokens           | 0.543     | -              | 0.543            |
| book a flight to Oslo                         | (none)               | migrations           | 0.470     | -              | 0.470            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.535     | -              | 0.535            |
| summarize this file                           | (none)               | commit-messages      | 0.621     | -              | 0.621            |
| explain how photosynthesis works              | (none)               | commit-messages      | 0.500     | -              | 0.500            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.383     | -              | 0.383            |

### gte-small

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops            | 0.824     | 0.824          | 0.787            |
| go over every item in a list                  | for-loops            | for-loops            | 0.796     | 0.796          | 0.789            |
| my branch is behind main                      | rebase               | rebase               | 0.878     | 0.878          | 0.795            |
| fix the merge conflicts                       | rebase               | rebase               | 0.881     | 0.881          | 0.785            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.839     | 0.839          | 0.822            |
| ship the website to the live servers          | deploy               | deploy               | 0.839     | 0.839          | 0.794            |
| add a column to the users table               | migrations           | migrations           | 0.788     | 0.788          | 0.786            |
| should this function throw?                   | error-handling       | error-handling       | 0.825     | 0.825          | 0.786            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.825     | 0.825          | 0.798            |
| the container does not start on my laptop     | docker               | docker               | 0.816     | 0.816          | 0.775            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.831     | 0.831          | 0.759            |
| look at this PR before I merge it             | code-review          | rebase               | 0.818     | 0.781          | 0.818            |
| publish a new version of the library          | release              | deploy               | 0.796     | 0.793          | 0.796            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.818     | 0.818          | 0.787            |
| the server is slow, find out why              | profiling            | profiling            | 0.868     | 0.868          | 0.769            |
| where do I keep the database password         | secrets              | secrets              | 0.884     | 0.884          | 0.809            |
| convert a timestamp to local time             | dates                | dates                | 0.853     | 0.853          | 0.768            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.840     | 0.840          | 0.793            |
| blind users cannot use the signup form        | accessibility        | accessibility        | 0.799     | 0.799          | 0.768            |
| give this variable a clearer name             | naming               | naming               | 0.864     | 0.864          | 0.784            |
| print what the service does so I can debug it | logging              | logging              | 0.842     | 0.842          | 0.794            |
| what day is it                                | (none)               | dates                | 0.793     | -              | 0.793            |
| bake sourdough bread                          | (none)               | secrets              | 0.729     | -              | 0.729            |
| what is the capital of France                 | (none)               | secrets              | 0.716     | -              | 0.716            |
| hello                                         | (none)               | secrets              | 0.779     | -              | 0.779            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.803     | -              | 0.803            |
| yes                                           | (none)               | secrets              | 0.778     | -              | 0.778            |
| continue                                      | (none)               | commit-messages      | 0.786     | -              | 0.786            |
| book a flight to Oslo                         | (none)               | secrets              | 0.715     | -              | 0.715            |
| write a poem about the sea                    | (none)               | docker               | 0.752     | -              | 0.752            |
| summarize this file                           | (none)               | naming               | 0.816     | -              | 0.816            |
| explain how photosynthesis works              | (none)               | virtual-environments | 0.748     | -              | 0.748            |
| the cat knocked a glass off the table         | (none)               | accessibility        | 0.705     | -              | 0.705            |

### e5-small-v2

| Query                                         | Expected             | Top note             | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | -------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | dates                | 0.805     | 0.802          | 0.805            |
| go over every item in a list                  | for-loops            | naming               | 0.812     | 0.787          | 0.812            |
| my branch is behind main                      | rebase               | rebase               | 0.833     | 0.833          | 0.780            |
| fix the merge conflicts                       | rebase               | rebase               | 0.848     | 0.848          | 0.786            |
| describe my changes for git                   | commit-messages      | commit-messages      | 0.840     | 0.840          | 0.822            |
| ship the website to the live servers          | deploy               | deploy               | 0.805     | 0.805          | 0.800            |
| add a column to the users table               | migrations           | release              | 0.816     | 0.798          | 0.816            |
| should this function throw?                   | error-handling       | error-handling       | 0.819     | 0.819          | 0.817            |
| add a test for this function                  | unit-tests           | unit-tests           | 0.847     | 0.847          | 0.837            |
| the container does not start on my laptop     | docker               | docker               | 0.820     | 0.820          | 0.809            |
| which colour should this button have          | css-tokens           | css-tokens           | 0.832     | 0.832          | 0.801            |
| look at this PR before I merge it             | code-review          | code-review          | 0.828     | 0.828          | 0.806            |
| publish a new version of the library          | release              | release              | 0.811     | 0.811          | 0.780            |
| install the dependencies of a Python script   | virtual-environments | virtual-environments | 0.819     | 0.819          | 0.817            |
| the server is slow, find out why              | profiling            | profiling            | 0.853     | 0.853          | 0.793            |
| where do I keep the database password         | secrets              | secrets              | 0.874     | 0.874          | 0.828            |
| convert a timestamp to local time             | dates                | dates                | 0.853     | 0.853          | 0.805            |
| match an email address with a pattern         | regular-expressions  | regular-expressions  | 0.822     | 0.822          | 0.815            |
| blind users cannot use the signup form        | accessibility        | release              | 0.784     | 0.767          | 0.784            |
| give this variable a clearer name             | naming               | naming               | 0.848     | 0.848          | 0.810            |
| print what the service does so I can debug it | logging              | logging              | 0.819     | 0.819          | 0.801            |
| what day is it                                | (none)               | dates                | 0.820     | -              | 0.820            |
| bake sourdough bread                          | (none)               | unit-tests           | 0.768     | -              | 0.768            |
| what is the capital of France                 | (none)               | css-tokens           | 0.744     | -              | 0.744            |
| hello                                         | (none)               | css-tokens           | 0.779     | -              | 0.779            |
| thanks, that looks good                       | (none)               | css-tokens           | 0.761     | -              | 0.761            |
| yes                                           | (none)               | commit-messages      | 0.776     | -              | 0.776            |
| continue                                      | (none)               | for-loops            | 0.797     | -              | 0.797            |
| book a flight to Oslo                         | (none)               | dates                | 0.728     | -              | 0.728            |
| write a poem about the sea                    | (none)               | commit-messages      | 0.780     | -              | 0.780            |
| summarize this file                           | (none)               | naming               | 0.858     | -              | 0.858            |
| explain how photosynthesis works              | (none)               | naming               | 0.803     | -              | 0.803            |
| the cat knocked a glass off the table         | (none)               | release              | 0.720     | -              | 0.720            |

### snowflake-arctic-embed-xs

| Query                                         | Expected             | Top note            | Top score | Expected score | Best wrong score |
| --------------------------------------------- | -------------------- | ------------------- | --------- | -------------- | ---------------- |
| iterating                                     | for-loops            | for-loops           | 0.516     | 0.516          | 0.503            |
| go over every item in a list                  | for-loops            | for-loops           | 0.538     | 0.538          | 0.526            |
| my branch is behind main                      | rebase               | rebase              | 0.614     | 0.614          | 0.505            |
| fix the merge conflicts                       | rebase               | rebase              | 0.652     | 0.652          | 0.479            |
| describe my changes for git                   | commit-messages      | commit-messages     | 0.657     | 0.657          | 0.626            |
| ship the website to the live servers          | deploy               | deploy              | 0.596     | 0.596          | 0.554            |
| add a column to the users table               | migrations           | migrations          | 0.575     | 0.575          | 0.554            |
| should this function throw?                   | error-handling       | error-handling      | 0.613     | 0.613          | 0.542            |
| add a test for this function                  | unit-tests           | unit-tests          | 0.608     | 0.608          | 0.569            |
| the container does not start on my laptop     | docker               | docker              | 0.624     | 0.624          | 0.574            |
| which colour should this button have          | css-tokens           | css-tokens          | 0.593     | 0.593          | 0.487            |
| look at this PR before I merge it             | code-review          | code-review         | 0.577     | 0.577          | 0.537            |
| publish a new version of the library          | release              | migrations          | 0.558     | 0.547          | 0.558            |
| install the dependencies of a Python script   | virtual-environments | naming              | 0.667     | 0.661          | 0.667            |
| the server is slow, find out why              | profiling            | profiling           | 0.631     | 0.631          | 0.534            |
| where do I keep the database password         | secrets              | secrets             | 0.688     | 0.688          | 0.643            |
| convert a timestamp to local time             | dates                | dates               | 0.599     | 0.599          | 0.496            |
| match an email address with a pattern         | regular-expressions  | regular-expressions | 0.643     | 0.643          | 0.534            |
| blind users cannot use the signup form        | accessibility        | accessibility       | 0.529     | 0.529          | 0.520            |
| give this variable a clearer name             | naming               | naming              | 0.631     | 0.631          | 0.532            |
| print what the service does so I can debug it | logging              | logging             | 0.606     | 0.606          | 0.563            |
| what day is it                                | (none)               | dates               | 0.550     | -              | 0.550            |
| bake sourdough bread                          | (none)               | error-handling      | 0.447     | -              | 0.447            |
| what is the capital of France                 | (none)               | naming              | 0.495     | -              | 0.495            |
| hello                                         | (none)               | accessibility       | 0.536     | -              | 0.536            |
| thanks, that looks good                       | (none)               | code-review         | 0.500     | -              | 0.500            |
| yes                                           | (none)               | accessibility       | 0.501     | -              | 0.501            |
| continue                                      | (none)               | code-review         | 0.495     | -              | 0.495            |
| book a flight to Oslo                         | (none)               | migrations          | 0.483     | -              | 0.483            |
| write a poem about the sea                    | (none)               | commit-messages     | 0.558     | -              | 0.558            |
| summarize this file                           | (none)               | naming              | 0.549     | -              | 0.549            |
| explain how photosynthesis works              | (none)               | dates               | 0.523     | -              | 0.523            |
| the cat knocked a glass off the table         | (none)               | error-handling      | 0.467     | -              | 0.467            |
