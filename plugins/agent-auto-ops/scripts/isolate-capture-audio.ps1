param(
  [Parameter(Mandatory=$true)][string]$InstanceId,
  [Parameter(Mandatory=$true)][string]$ExpectedName,
  [ValidateSet('Inspect','Disable','Enable')][string]$Mode='Inspect'
)
$ErrorActionPreference='Stop'
$device=Get-PnpDevice -InstanceId $InstanceId
if($device.Class -ne 'MEDIA' -or $device.FriendlyName -cne $ExpectedName -or $InstanceId -notmatch '^USB\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}&MI_[0-9A-F]{2}\\'){
  throw 'Identity mismatch. Only an explicitly named USB audio child interface is accepted.'
}
$service=(Get-PnpDeviceProperty -InstanceId $InstanceId -KeyName DEVPKEY_Device_Service).Data
if($service -notmatch '^usbaudio2?$'){throw ('Not a USB audio driver: '+$service)}
if($Mode -ne 'Inspect'){
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $principal=[Security.Principal.WindowsPrincipal]::new($identity)
  if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
    throw 'Administrator rights required. No device settings were changed.'
  }
  if($Mode -eq 'Disable'){Disable-PnpDevice -InstanceId $InstanceId -Confirm:$false}
  else{Enable-PnpDevice -InstanceId $InstanceId -Confirm:$false}
}
$state=Get-PnpDevice -InstanceId $InstanceId
$problem=(Get-PnpDeviceProperty -InstanceId $InstanceId -KeyName DEVPKEY_Device_ProblemCode).Data
[pscustomobject]@{name=$state.FriendlyName;instance_id=$state.InstanceId;status=$state.Status;problem_code=$problem;disabled=($problem -eq 22);mode=$Mode} | ConvertTo-Json
