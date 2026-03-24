# find-toctoc-ids.ps1
# Corre esto para encontrar los IDs de comunas nuevas en TocToc
# Prueba IDs del 310 al 360 y reporta cuáles tienen departamentos

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Buscando IDs de comunas en TocToc..." -ForegroundColor Cyan
Write-Host ""

# Primero obtener sesión
$null = Invoke-WebRequest -Uri "https://www.toctoc.com/arriendo/departamento/metropolitana/santiago" -Headers @{"User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"} -UseBasicParsing -SessionVariable session

# IDs conocidos para referencia
$known = @{
    311 = "Lo Barnechea"; 312 = "Vitacura"; 313 = "Las Condes"; 314 = "La Reina";
    315 = "Penalolen"; 316 = "La Florida"; 320 = "Maipu"; 324 = "Independencia";
    325 = "Recoleta"; 326 = "Conchali"; 335 = "San Miguel"; 336 = "Quinta Normal";
    337 = "Providencia"; 338 = "Estacion Central"; 339 = "Santiago"; 340 = "Nunoa";
    341 = "San Joaquin"; 342 = "Macul"
}

# Probar todos los IDs del 310 al 360
for ($id = 310; $id -le 360; $id++) {
    $filtros = '[{"id":"tipo-de-busqueda","type":"radio","values":[{"id":2,"value":[3]}],"mainFilter":true},{"id":"tipo-de-propiedad","type":"check","values":[{"id":2,"value":[2]}],"mainFilter":true},{"id":"region","type":"select","values":[{"id":13,"value":[13]}]},{"id":"comuna","type":"select","values":[{"id":' + $id + ',"value":[' + $id + ']}]}]'
    
    try {
        $encoded = [uri]::EscapeDataString($filtros)
        $url = "https://www.toctoc.com/gw-lista-seo/propiedades?filtros=$encoded&order=1&page=1"
        
        $r = Invoke-WebRequest -Uri $url -Headers @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            "Accept" = "application/json"
            "Referer" = "https://www.toctoc.com/arriendo/departamento/metropolitana/santiago"
        } -UseBasicParsing -WebSession $session
        
        $data = $r.Content | ConvertFrom-Json
        
        if ($data.total -gt 0) {
            $comuna = if ($data.results -and $data.results[0].comuna) { $data.results[0].comuna } else { "???" }
            $status = if ($known.ContainsKey($id)) { "[YA TENEMOS]" } else { "[NUEVA]" }
            
            if ($known.ContainsKey($id)) {
                Write-Host "  ID $id = $comuna ($($data.total) deptos arriendo) $status" -ForegroundColor Gray
            } else {
                Write-Host "  ID $id = $comuna ($($data.total) deptos arriendo) $status" -ForegroundColor Green
            }
        }
        
        Start-Sleep -Milliseconds 300
    } catch {
        # Silently skip errors
    }
}

Write-Host ""
Write-Host "Listo! Copia los IDs [NUEVA] que quieras agregar." -ForegroundColor Cyan
