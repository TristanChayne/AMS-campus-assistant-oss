param(
    [Parameter(Mandatory)][ValidateSet('android','ios','miniprogram','repository')][string]$Platform,
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
    [ValidateRange(1,2147483647)][int]$Build,
    [ValidateRange(0,2147483647)][int]$Stage = 0,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Summary
)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
function Invoke-Git([string[]]$GitArgs) {
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $($GitArgs[0]). Local records are preserved." }
}
if ($Platform -eq 'repository') {
    if (!$Stage -or $Version -or $Build) { throw 'Repository stages require -Stage and must not specify app Version/Build.' }
    $tag = "repo-stage-$Stage"
} else {
    if (!$Version) { throw 'App platforms require a version.' }
    if ($Platform -ne 'miniprogram' -and !$Build) { throw 'Android and iOS require a build number.' }
    $tag = "$Platform-v$Version"
    if ($Build) { $tag += "-build$Build" }
    if ($Stage) { $tag += "-stage-$Stage" }
}
Invoke-Git @('check-ref-format', "refs/tags/$tag")
$branch = & git symbolic-ref --quiet --short HEAD
if ($LASTEXITCODE -ne 0) { throw 'A named branch is required.' }
Invoke-Git @('remote','get-url','origin')
& git diff --quiet
if ($LASTEXITCODE -ne 0) { throw 'Unstaged changes exist. Review and stage this phase first.' }
$untracked = & git ls-files --others --exclude-standard
if ($untracked) { throw 'Untracked source files exist. Review and stage them first.' }
& git show-ref --verify --quiet "refs/tags/$tag"
$exists = $LASTEXITCODE -eq 0
if ($exists) {
    $tagCommit = & git rev-list -n 1 $tag
    $headCommit = & git rev-parse HEAD
    & git diff --cached --quiet
    if ($LASTEXITCODE -ne 0 -or $tagCommit -ne $headCommit) { throw 'Tag already exists for another state; use a new version or Stage number.' }
} else {
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) { Invoke-Git @('commit','-m', "$tag`: $Summary") }
    elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged changes.' }
    Invoke-Git @('tag','-a',$tag,'-m',$Summary)
}
Invoke-Git @('push','--atomic','--set-upstream','origin',$branch,"refs/tags/$tag")
$localHead = & git rev-parse HEAD
$localTag = & git rev-parse "refs/tags/$tag"
$remote = & git ls-remote origin "refs/heads/$branch" "refs/tags/$tag"
if ($LASTEXITCODE -ne 0 -or !($remote -match "^$localHead\s+refs/heads/$branch$") -or !($remote -match "^$localTag\s+refs/tags/$tag$")) { throw 'Remote verification failed; cloud backup is not confirmed.' }
Write-Output "Cloud backup verified: $tag ($localHead)"
