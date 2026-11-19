#!/usr/bin/env bash
# Audit one GitHub repo against the repo-standard. Prints JSON.
# usage: audit.sh <owner/repo | repo>     (owner defaults to justAnArthur)
set -euo pipefail
repo="$1"; [[ "$repo" == */* ]] || repo="justAnArthur/$repo"
owner="${repo%%/*}"; name="${repo#*/}"

meta=$(gh api graphql -F owner="$owner" -F name="$name" -f query='
query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){
  name isPrivate isFork isArchived description homepageUrl createdAt pushedAt diskUsage stargazerCount
  parent{nameWithOwner defaultBranchRef{name}}
  licenseInfo{spdxId}
  repositoryTopics(first:20){nodes{topic{name}}}
  languages(first:5,orderBy:{field:SIZE,direction:DESC}){nodes{name}}
  releases{totalCount} tags:refs(refPrefix:"refs/tags/"){totalCount}
  issues(states:OPEN){totalCount}
  pullRequests(states:OPEN,first:30){totalCount nodes{number title author{login}}}
  defaultBranchRef{name target{... on Commit{committedDate history{totalCount}}}}
  root:object(expression:"HEAD:"){... on Tree{entries{name type}}}
}}' --jq '.data.repository')

readme=$(gh api "repos/$repo/readme" -H "Accept: application/vnd.github.raw" 2>/dev/null || true)
readme_bytes=${#readme}
boilerplate=false
grep -qiE 'bootstrapped with|create-next-app|v0\.(dev|app)|This template provides a minimal setup|Template ToDo list|Mintlify Starter Kit' <<<"$readme" && boilerplate=true

fork_status=null
if [[ $(jq -r .isFork <<<"$meta") == true ]]; then
  parent=$(jq -r .parent.nameWithOwner <<<"$meta"); pb=$(jq -r .parent.defaultBranchRef.name <<<"$meta")
  mb=$(jq -r .defaultBranchRef.name <<<"$meta")
  fork_status=$(gh api "repos/$parent/compare/$pb...$owner:$name:$mb" --jq '{ahead:.ahead_by,behind:.behind_by}' 2>/dev/null || echo null)
fi

jq -n --argjson m "$meta" --argjson rb "$readme_bytes" --argjson bp "$boilerplate" --argjson fork "$fork_status" '
  ($m.root.entries // [] | map(.name)) as $files
  | ($m.repositoryTopics.nodes | map(.topic.name)) as $topics
  | {
    repo: $m.name, private: $m.isPrivate, fork: $m.isFork, archived: $m.isArchived,
    description: $m.description, homepage: $m.homepageUrl, topics: $topics,
    license: $m.licenseInfo.spdxId, languages: [$m.languages.nodes[].name],
    created: $m.createdAt[0:10], last_commit: ($m.defaultBranchRef.target.committedDate // "")[0:10],
    commits: ($m.defaultBranchRef.target.history.totalCount // 0), default_branch: $m.defaultBranchRef.name,
    releases: $m.releases.totalCount, tags: $m.tags.totalCount, open_issues: $m.issues.totalCount,
    open_prs: [$m.pullRequests.nodes[] | {number, title, author: .author.login}],
    fork_vs_upstream: $fork, upstream: $m.parent.nameWithOwner,
    readme_bytes: $rb, root_files: $files,
    gaps: ([
      (if $rb == 0 then "no README" elif $bp then "boilerplate README" elif $rb < 400 then "thin README" else empty end),
      (if ($m.description // "") == "" then "no description" else empty end),
      (if ($topics | length) < 3 then "fewer than 3 topics" else empty end),
      (if ($m.isPrivate or $m.isFork) | not and $m.licenseInfo == null then "no LICENSE" else empty end),
      (if ($files | index(".gitignore")) == null then "no .gitignore" else empty end),
      ($files[] | select(. == ".idea" or . == "__pycache__" or . == ".DS_Store") | "untrack \(.)"),
      ($files[] | select(test("^\\.env$|^\\.env\\.(local|production|test)$")) | "committed \(.)"),
      (if $m.pullRequests.totalCount > 0 then "\($m.pullRequests.totalCount) open PRs" else empty end)
    ] | if $m.isFork then map(select(. == "no description")) else . end)
  }'
