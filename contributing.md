# Contributing

This agreement is for collaboration, it may not be detailed enough, if it is not clear how to do what you want, this is a normal situation, just ask your colleagues.

## Main flow

```shell
git clone git@github.com:midcontract/protocol.git midcontract-protocol
cd midcontract-protocol
git checkout -b name-of-feature origin/main
```

Coding and testing local see [README.md Development](https://github.com/midcontract/protocol#development)

> Git history: work log vs recipe https://www.bitsnbites.eu/git-history-work-log-vs-recipe/

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

```shell
git commit --message "feat: paypal payment for different users"
```

or

```shell
git commit --message "fix: hide password display when searching for a user"
```

Push and create merge requests

```shell
git push --set-upstream origin name-of-feature
```

Follow by link:

```shell
https://github.com/midcontract/protocol/pull/new/name-of-feature
```

## Update branch from main

> A tidy, linear Git history  https://www.bitsnbites.eu/a-tidy-linear-git-history/

Get the latest upstream changes and update the working branch:

```shell
git fetch --prune origin
git rebase --autostash --ignore-date origin/main
```

During the rebase, there may be conflicts, they need to be resolved and after the decision to continue the rebase:

```shell
git rebase --continue
```

Upload the updated working branch to the repository, given that we changed the history, this should be done with the force option:

```shell
git push --force --set-upstream origin name-of-feature
```

More details can be found in the tutorial: [git rebase](https://www.atlassian.com/git/tutorials/rewriting-history/git-rebase).
