param([Parameter(Mandatory=$true)][ValidatePattern('^COM[1-9][0-9]*$')][string]$Port)
$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$cuaSerial=[IO.Ports.SerialPort]::new($Port,115200,[IO.Ports.Parity]::None,8,[IO.Ports.StopBits]::One)
$cuaSerial.DtrEnable=$false
$cuaSerial.RtsEnable=$false
$cuaSerial.ReadTimeout=4500
$cuaSerial.WriteTimeout=1000
$cuaSerial.NewLine=[string][char]10
try {
    $cuaSerial.Open()
    while($null -ne ($cuaLine=[Console]::ReadLine())) {
        if($cuaLine.Length -gt 8000) { throw 'Request exceeds wire bound' }
        $cuaRequest=$cuaLine | ConvertFrom-Json
        $cuaSerial.DiscardInBuffer()
        $cuaSerial.WriteLine($cuaLine)
        $cuaWatch=[Diagnostics.Stopwatch]::StartNew()
        $cuaReply=$null
        while($cuaWatch.ElapsedMilliseconds -lt 4500) {
            $cuaRaw=$cuaSerial.ReadLine()
            if($cuaRaw.StartsWith('@cua ')) {
                $cuaParsed=$cuaRaw.Substring(5) | ConvertFrom-Json
                if($cuaParsed.op -eq $cuaRequest.op -and ($cuaParsed.seq -eq $cuaRequest.seq -or ($cuaRequest.op -eq 'heartbeat' -and $cuaRequest.seq -eq 0 -and $null -eq $cuaParsed.seq))) {
                    $cuaReply=$cuaParsed; break
                }
            }
        }
        if($null -eq $cuaReply) { throw 'No matching adapter acknowledgement; outcome unknown' }
        [Console]::WriteLine(($cuaReply | ConvertTo-Json -Depth 12 -Compress))
    }
} catch {
    [Console]::WriteLine((@{bridge_error=$_.Exception.Message} | ConvertTo-Json -Compress))
    exit 1
} finally {
    if($cuaSerial.IsOpen) { $cuaSerial.Close() }
    $cuaSerial.Dispose()
}
