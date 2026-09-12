$base = 'http://localhost:3000/api'
$accounts = @(
  @{ role = 'HR'; email = 'ukn_cse@vignan.ac.in'; password = 'Vignan@01918' },
  @{ role = 'HOD'; email = 'drsvpk_cse@vignan.ac.in'; password = 'Vignan@675' },
  @{ role = 'DEAN'; email = 'kvkkishore@vignan.ac.in'; password = 'Vignan@163' },
  @{ role = 'PRINCIPAL'; email = 'sdk_cse@vignan.ac.in'; password = 'Vignan@189' },
  @{ role = 'FACULTY-SKS'; email = 'sks_cse@vignan.ac.in'; password = 'Vignan@01919' },
  @{ role = 'FACULTY-SSK'; email = 'ssk_cse@vignan.ac.in'; password = 'Vignan@02172' }
)

function Invoke-Api {
  param($Method, $Path, $Token, $Body)
  $headers = @{ }
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $params = @{
      Uri = "$base$Path"
      Method = $Method
      Headers = $headers
    }
    if ($Body) {
      $params.ContentType = 'application/json'
      $params.Body = ($Body | ConvertTo-Json -Compress)
    }
    $res = Invoke-WebRequest @params
    $sw.Stop()
    $parsed = $null
    try { $parsed = $res.Content | ConvertFrom-Json } catch { }
    return [pscustomobject]@{
      ok = $true
      status = [int]$res.StatusCode
      ms = $sw.ElapsedMilliseconds
      json = $parsed
      raw = $res.Content
    }
  } catch {
    $sw.Stop()
    $status = 0
    $raw = $_.ErrorDetails.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    return [pscustomobject]@{
      ok = $false
      status = $status
      ms = $sw.ElapsedMilliseconds
      json = $null
      raw = $raw
    }
  }
}

$tokens = @{}
$users = @{}
Write-Output '=== LOGINS ==='
foreach ($a in $accounts) {
  $r = Invoke-Api POST '/auth/login' $null @{ email = $a.email; password = $a.password }
  Write-Output ("{0} login {1} {2}ms" -f $a.role, $r.status, $r.ms)
  if ($r.json.accessToken) {
    $tokens[$a.role] = $r.json.accessToken
    $users[$a.role] = $r.json.user
  }
}

Write-Output '`n=== AUTH ME + PROFILE PATCH ==='
foreach ($role in @('HR','HOD','DEAN','PRINCIPAL','FACULTY-SKS')) {
  $me = Invoke-Api GET '/auth/me' $tokens[$role]
  Write-Output ("{0} GET /auth/me {1} {2}ms name={3} phone={4} photo={5}" -f $role, $me.status, $me.ms, $me.json.name, $me.json.phone, $me.json.photoUrl)
}

$patch = Invoke-Api PATCH '/auth/me' $tokens['FACULTY-SKS'] @{ name = $users['FACULTY-SKS'].name; phone = '7981403193' }
Write-Output ("SKS PATCH /auth/me {0} {1}ms phone={2}" -f $patch.status, $patch.ms, $patch.json.phone)

Write-Output '`n=== DASHBOARDS (timed) ==='
$hod1 = Invoke-Api GET '/hod/dashboard' $tokens['HOD']
Write-Output ("HOD dashboard #1 {0} {1}ms faculty={2} avg={3}" -f $hod1.status, $hod1.ms, $hod1.json.totalFaculty, $hod1.json.averageWorkload)
$hod2 = Invoke-Api GET '/hod/dashboard' $tokens['HOD']
Write-Output ("HOD dashboard #2 {0} {1}ms faculty={2}" -f $hod2.status, $hod2.ms, $hod2.json.totalFaculty)

$hr1 = Invoke-Api GET '/hr/dashboard' $tokens['HR']
Write-Output ("HR dashboard #1 {0} {1}ms faculty={2} normal={3} over={4} under={5}" -f $hr1.status, $hr1.ms, $hr1.json.facultyCount, $hr1.json.normal, $hr1.json.overload, $hr1.json.underload)
$hr2 = Invoke-Api GET '/hr/dashboard' $tokens['HR']
Write-Output ("HR dashboard #2 {0} {1}ms" -f $hr2.status, $hr2.ms)

$dean = Invoke-Api GET '/dean/dashboard' $tokens['DEAN']
Write-Output ("Dean dashboard {0} {1}ms faculty={2} pending={3}" -f $dean.status, $dean.ms, $dean.json.totalFaculty, $dean.json.pending.Count)

$prin1 = Invoke-Api GET '/principal/dashboard' $tokens['PRINCIPAL']
Write-Output ("Principal dashboard #1 {0} {1}ms faculty={2}" -f $prin1.status, $prin1.ms, $prin1.json.totalFaculty)
$prin2 = Invoke-Api GET '/principal/dashboard' $tokens['PRINCIPAL']
Write-Output ("Principal dashboard #2 {0} {1}ms" -f $prin2.status, $prin2.ms)

$fac = Invoke-Api GET '/faculty/me/workload' $tokens['FACULTY-SKS']
Write-Output ("SKS workload {0} {1}ms total={2} status={3}" -f $fac.status, $fac.ms, $fac.json.breakdown.total, $fac.json.breakdown.status)

$sum = Invoke-Api GET '/workload/dashboard-summary' $tokens['HR']
Write-Output ("HR dashboard-summary {0} {1}ms {2}" -f $sum.status, $sum.ms, ($sum.json | ConvertTo-Json -Compress))

Write-Output '`n=== SECURITY ==='
$sskId = $users['FACULTY-SSK'].facultyId
$sksCross = Invoke-Api GET "/workload/faculty/$sskId" $tokens['FACULTY-SKS']
Write-Output ("SKS GET SSK workload {0} (expect 403) {1}ms" -f $sksCross.status, $sksCross.ms)

$instCsv = Invoke-Api GET '/reports/institution/csv' $tokens['FACULTY-SKS']
Write-Output ("SKS institution CSV {0} (expect 403) {1}ms" -f $instCsv.status, $instCsv.ms)

Write-Output '`n=== WHAT-IF (no DB write) ==='
$sksId = $users['FACULTY-SKS'].facultyId
$before = Invoke-Api GET "/workload/faculty/$sksId" $tokens['HOD']
$sim = Invoke-Api POST '/workload/simulate' $tokens['HOD'] @{
  facultyId = $sksId
  activityType = 'THEORY'
  additionalHours = 4
}
$after = Invoke-Api GET "/workload/faculty/$sksId" $tokens['HOD']
Write-Output ("simulate {0} {1}ms current={2} projected={3} status={4} alts={5}" -f $sim.status, $sim.ms, $sim.json.current.total, $sim.json.projected.total, $sim.json.status, $sim.json.alternatives.Count)
Write-Output ("totals before={0} after={1} (must match)" -f $before.json.total, $after.json.total)

Write-Output '`n=== COURSES ==='
$courses = Invoke-Api GET '/hod/courses' $tokens['HOD']
Write-Output ("HOD courses {0} {1}ms count={2}" -f $courses.status, $courses.ms, $courses.json.Count)
