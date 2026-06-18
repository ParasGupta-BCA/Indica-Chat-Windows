[void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")

# Get parent process (the installer) to monitor its lifecycle
$myPid = $pid
$parentPid = $null
try {
    $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $myPid" -ErrorAction SilentlyContinue).ParentProcessId
} catch {}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Indica Setup Background"
$form.WindowState = "Maximized"
$form.FormBorderStyle = "None"
$form.BackColor = [System.Drawing.Color]::Black
$form.TopMost = $false

$browser = New-Object System.Windows.Forms.WebBrowser
$browser.Dock = [System.Windows.Forms.DockStyle]::Fill
$browser.ScrollBarsEnabled = $false
$browser.WebBrowserShortcutsEnabled = $false
$browser.IsWebBrowserContextMenuEnabled = $false

$html = @"
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #000;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
</head>
<body>
  <video autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;">
    <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_115655_b4d9cd77-feed-43cd-a198-af78ebdf1f7a.mp4" type="video/mp4">
  </video>
</body>
</html>
"@

$form.Controls.Add($browser)

$form.Add_Load({
    $browser.DocumentText = $html
})

# Close on ESC key press
$form.Add_KeyDown({
    if ($_.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
        $form.Close()
    }
})
$form.KeyPreview = $true

# Timer to check if the parent (installer) process has exited
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500 # check every 500ms
$timer.Add_Tick({
    if ($parentPid) {
        $process = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
        if ($null -eq $process -or $process.HasExited) {
            $timer.Stop()
            $form.Close()
        }
    } else {
        $timer.Stop()
        $form.Close()
    }
})
$timer.Start()

[System.Windows.Forms.Application]::Run($form)
