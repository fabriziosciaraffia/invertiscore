# scrape-toctoc.ps1 - Scraper local de TocToc
# Correr: .\scrape-toctoc.ps1
# Detecta nuevo/usado, interpola tipologias de proyectos nuevos
# v2: 24 comunas, MAX_PAGES=50

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$FRANCO_URL = "https://invertiscore.vercel.app"
$CRON_SECRET = "Kso1Qhv5OO8Fx1N6wPddXUC1GAAZTsH5tTixHRS2xAI="
$MAX_PAGES = 50

$COMUNAS = @{
    # === ORIGINALES (18) ===
    "santiago"         = @{ id = 339; label = "Santiago" }
    "providencia"      = @{ id = 337; label = "Providencia" }
    "las-condes"       = @{ id = 313; label = "Las Condes" }
    "nunoa"            = @{ id = 340; label = "Nunoa" }
    "la-florida"       = @{ id = 316; label = "La Florida" }
    "vitacura"         = @{ id = 312; label = "Vitacura" }
    "lo-barnechea"     = @{ id = 311; label = "Lo Barnechea" }
    "san-miguel"       = @{ id = 335; label = "San Miguel" }
    "macul"            = @{ id = 342; label = "Macul" }
    "penalolen"        = @{ id = 315; label = "Penalolen" }
    "la-reina"         = @{ id = 314; label = "La Reina" }
    "estacion-central" = @{ id = 338; label = "Estacion Central" }
    "independencia"    = @{ id = 324; label = "Independencia" }
    "recoleta"         = @{ id = 325; label = "Recoleta" }
    "maipu"            = @{ id = 320; label = "Maipu" }
    "san-joaquin"      = @{ id = 341; label = "San Joaquin" }
    "quinta-normal"    = @{ id = 336; label = "Quinta Normal" }
    "conchali"         = @{ id = 326; label = "Conchali" }
    # === NUEVAS (6) ===
    "la-cisterna"      = @{ id = 330; label = "La Cisterna" }
    "cerrillos"        = @{ id = 321; label = "Cerrillos" }
    "renca"            = @{ id = 322; label = "Renca" }
    "huechuraba"       = @{ id = 327; label = "Huechuraba" }
    "quilicura"        = @{ id = 323; label = "Quilicura" }
    "pudahuel"         = @{ id = 317; label = "Pudahuel" }
}

$TIPOS = @(
    @{ slug = "arriendo"; filtroId = 2; filtroValue = @(3) },
    @{ slug = "venta";    filtroId = 1; filtroValue = @(1, 2) }
)

function Get-TocTocSession {
    Write-Host "Obteniendo sesion de TocToc..." -ForegroundColor Cyan
    $null = Invoke-WebRequest -Uri "https://www.toctoc.com/arriendo/departamento/metropolitana/santiago" -Headers @{"User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"} -UseBasicParsing -SessionVariable s
    Write-Host "Sesion obtenida OK" -ForegroundColor Green
    return (Get-Variable -Name s -ValueOnly)
}

function Fix-ComunaName {
    param([string]$Name)
    $fixed = $Name
    $fixed = $fixed -replace [char]0xF1, "n"
    $fixed = $fixed -replace [char]0xE1, "a"
    $fixed = $fixed -replace [char]0xE9, "e"
    $fixed = $fixed -replace [char]0xED, "i"
    $fixed = $fixed -replace [char]0xF3, "o"
    $fixed = $fixed -replace [char]0xFA, "u"
    switch ($fixed) {
        "Nunoa"            { return "Nunoa" }
        "Penalolen"        { return "Penalolen" }
        "Conchali"         { return "Conchali" }
        "Maipu"            { return "Maipu" }
        "San Joaquin"      { return "San Joaquin" }
        "Estacion Central" { return "Estacion Central" }
        default            { return $Name }
    }
}

function Parse-Superficie {
    param([string]$val)
    if (-not $val) { return $null }
    $clean = $val -replace ",", "."
    try {
        $s = [math]::Round([double]$clean)
        if ($s -gt 0 -and $s -le 300) { return $s }
    } catch {}
    return $null
}

function Get-Properties {
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [string]$ComunaSlug,
        [hashtable]$ComunaInfo,
        [hashtable]$Tipo
    )
    
    $properties = @()
    $fv = ConvertTo-Json -InputObject $Tipo.filtroValue -Compress
    $filtros = '[{"id":"tipo-de-busqueda","type":"radio","values":[{"id":' + $Tipo.filtroId + ',"value":' + $fv + '}],"mainFilter":true},{"id":"tipo-de-propiedad","type":"check","values":[{"id":2,"value":[2]}],"mainFilter":true},{"id":"region","type":"select","values":[{"id":13,"value":[13]}]},{"id":"comuna","type":"select","values":[{"id":' + $ComunaInfo.id + ',"value":[' + $ComunaInfo.id + ']}]}]'
    
    $page = 1
    $totalPages = 1
    
    while ($page -le [Math]::Min($totalPages, $MAX_PAGES)) {
        try {
            $encoded = [uri]::EscapeDataString($filtros)
            $url = "https://www.toctoc.com/gw-lista-seo/propiedades?filtros=$encoded&order=1&page=$page"
            
            $r = Invoke-WebRequest -Uri $url -Headers @{
                "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                "Accept" = "application/json"
                "Referer" = "https://www.toctoc.com/$($Tipo.slug)/departamento/metropolitana/$ComunaSlug"
            } -UseBasicParsing -WebSession $Session
            
            $data = $r.Content | ConvertFrom-Json
            
            if ($page -eq 1) {
                $totalPages = [Math]::Ceiling($data.total / 20)
                Write-Host "    $($ComunaInfo.label) $($Tipo.slug): $($data.total) total ($totalPages pags)" -ForegroundColor Gray
            }
            
            if (-not $data.results -or $data.results.Count -eq 0) { break }
            
            foreach ($item in $data.results) {
                # Precio
                $precio = 0
                $moneda = "CLP"
                if ($item.precios) {
                    foreach ($p in $item.precios) {
                        if ($p.prefix -eq "`$") {
                            $val = $p.value -replace "\.", ""
                            try { $precio = [int]$val } catch { $precio = 0 }
                            $moneda = "CLP"
                            break
                        }
                    }
                    if ($precio -eq 0) {
                        foreach ($p in $item.precios) {
                            if ($p.prefix -eq "UF") {
                                $val = $p.value -replace "\.", "" -replace ",", "."
                                try { $precio = [double]$val } catch { $precio = 0 }
                                $moneda = "UF"
                                break
                            }
                        }
                    }
                }
                if ($precio -eq 0) { continue }
                
                # Condicion desde tipoOperacion
                $condicion = "usado"
                if ($item.tipoOperacion -and $item.tipoOperacion -like "*Nuevo*") {
                    $condicion = "nuevo"
                }
                
                # Comuna
                $comunaName = if ($item.comuna) { Fix-ComunaName $item.comuna } else { $ComunaInfo.label }
                
                # Superficie y dormitorios
                $supMin = $null
                $supMax = $null
                $dormMin = $null
                $dormMax = $null
                $banosMin = $null
                
                if ($item.superficie -and $item.superficie.Count -gt 0) {
                    $supMin = Parse-Superficie $item.superficie[0]
                    if ($item.superficie.Count -gt 1) {
                        $supMax = Parse-Superficie $item.superficie[1]
                    }
                }
                
                if ($item.dormitorios -and $item.dormitorios.Count -gt 0 -and $item.dormitorios[0]) {
                    try { $d = [int]($item.dormitorios[0]); if ($d -gt 0) { $dormMin = $d } } catch {}
                    if ($item.dormitorios.Count -gt 1 -and $item.dormitorios[1]) {
                        try { $d2 = [int]($item.dormitorios[1]); if ($d2 -gt 0) { $dormMax = $d2 } } catch {}
                    }
                }
                
                if ($item.bannos -and $item.bannos.Count -gt 0 -and $item.bannos[0]) {
                    try { $b = [int]($item.bannos[0]); if ($b -gt 0) { $banosMin = $b } } catch {}
                }
                
                # Registro 1: tipologia minima (o unica si es usado)
                $prop1 = @{
                    source = "toctoc"
                    source_id = $item.urlFicha
                    type = $Tipo.slug
                    comuna = $comunaName
                    direccion = $item.titulo
                    precio = $precio
                    moneda = $moneda
                    superficie_m2 = $supMin
                    dormitorios = $dormMin
                    banos = $banosMin
                    url = $item.urlFicha
                    is_active = $true
                    geocode_attempted = $false
                    condicion = $condicion
                }
                $properties += $prop1
                
                # Registro 2: tipologia maxima (solo si es nuevo Y tiene rango diferente)
                if ($condicion -eq "nuevo" -and $supMin -and $supMax -and $supMax -ne $supMin -and $supMax -gt $supMin) {
                    # Interpolar precio: mantener precio/m2 constante
                    $precioM2 = $precio / $supMin
                    $precioMax = [math]::Round($precioM2 * $supMax)
                    
                    $prop2 = @{
                        source = "toctoc"
                        source_id = "$($item.urlFicha)__max"
                        type = $Tipo.slug
                        comuna = $comunaName
                        direccion = "$($item.titulo) (max)"
                        precio = $precioMax
                        moneda = $moneda
                        superficie_m2 = $supMax
                        dormitorios = if ($dormMax) { $dormMax } else { $dormMin }
                        banos = $banosMin
                        url = $item.urlFicha
                        is_active = $true
                        geocode_attempted = $false
                        condicion = "nuevo"
                    }
                    $properties += $prop2
                }
            }
            
            $page++
            Start-Sleep -Milliseconds 500
            
        } catch {
            Write-Host "    Error p${page}: $_" -ForegroundColor Red
            break
        }
    }
    
    return $properties
}

# === MAIN ===

Write-Host ""
Write-Host "FRANCO - Scraper TocToc v2 (24 comunas, max $MAX_PAGES pags/comuna)" -ForegroundColor Red
Write-Host "==============================================" -ForegroundColor Red
Write-Host ""

$startTime = Get-Date
$session = Get-TocTocSession
$allProperties = @()

foreach ($tipo in $TIPOS) {
    Write-Host ""
    Write-Host "=== $($tipo.slug.ToUpper()) ===" -ForegroundColor Yellow
    
    foreach ($comunaSlug in $COMUNAS.Keys | Sort-Object) {
        $comunaInfo = $COMUNAS[$comunaSlug]
        $props = Get-Properties -Session $session -ComunaSlug $comunaSlug -ComunaInfo $comunaInfo -Tipo $tipo
        $allProperties += $props
        
        $nuevo = ($props | Where-Object { $_.condicion -eq "nuevo" }).Count
        $usado = ($props | Where-Object { $_.condicion -eq "usado" }).Count
        if ($nuevo -gt 0 -and $usado -gt 0) {
            Write-Host "    -> $($props.Count) props ($usado usado, $nuevo nuevo)" -ForegroundColor Green
        } elseif ($nuevo -gt 0) {
            Write-Host "    -> $($props.Count) props (nuevo)" -ForegroundColor Green
        } else {
            Write-Host "    -> $($props.Count) propiedades" -ForegroundColor Green
        }
    }
}

Write-Host ""
$arriendos = ($allProperties | Where-Object { $_.type -eq "arriendo" }).Count
$ventaUsado = ($allProperties | Where-Object { $_.type -eq "venta" -and $_.condicion -eq "usado" }).Count
$ventaNuevo = ($allProperties | Where-Object { $_.type -eq "venta" -and $_.condicion -eq "nuevo" }).Count
Write-Host "Total scrapeado: $($allProperties.Count) propiedades" -ForegroundColor Cyan
Write-Host "  Arriendos: $arriendos | Venta usado: $ventaUsado | Venta nuevo: $ventaNuevo" -ForegroundColor Gray

if ($allProperties.Count -gt 0) {
    Write-Host ""
    Write-Host "Enviando a Franco..." -ForegroundColor Cyan
    $batchSize = 100
    $sent = 0
    
    for ($i = 0; $i -lt $allProperties.Count; $i += $batchSize) {
        $end = [Math]::Min($i + $batchSize - 1, $allProperties.Count - 1)
        $batch = $allProperties[$i..$end]
        
        $body = @{ properties = $batch } | ConvertTo-Json -Depth 5 -Compress
        
        try {
            $r = Invoke-RestMethod -Uri "$FRANCO_URL/api/data/bulk-import" -Method POST -Headers @{ "Authorization" = "Bearer $CRON_SECRET"; "Content-Type" = "application/json" } -Body $body
            $sent += $batch.Count
            Write-Host "  Enviados $sent / $($allProperties.Count)" -ForegroundColor Gray
        } catch {
            Write-Host "  Error enviando batch: $_" -ForegroundColor Red
        }
    }
    Write-Host "Enviadas: $sent propiedades" -ForegroundColor Green
}

Write-Host ""
Write-Host "Geocodificando..." -ForegroundColor Cyan
$geoTotal = 0
$noProgress = 0
for ($i = 1; $i -le 500; $i++) {
    try {
        $r = Invoke-RestMethod -Uri "$FRANCO_URL/api/data/enrich-coords" -Method POST -Headers @{"Authorization"="Bearer $CRON_SECRET"}
        if ($r.processed -eq 0) { break }
        $geoTotal += $r.enriched
        if ($r.enriched -eq 0) {
            $noProgress++
            if ($noProgress -ge 3) { break }
        } else {
            $noProgress = 0
        }
        if ($i % 10 -eq 0) { Write-Host "  Geo: $geoTotal geocodificadas..." -ForegroundColor Gray }
    } catch { break }
}
Write-Host "Geocodificadas: $geoTotal" -ForegroundColor Green

Write-Host ""
Write-Host "Recalculando stats..." -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$FRANCO_URL/api/data/calculate-stats" -Method POST -Headers @{"Authorization"="Bearer $CRON_SECRET"}
    Write-Host "Stats: $($r.groups) grupos" -ForegroundColor Green
} catch {
    Write-Host "Error stats: $_" -ForegroundColor Red
}

$elapsed = (Get-Date) - $startTime
Write-Host ""
Write-Host "==============================================" -ForegroundColor Red
Write-Host "Completado en $([Math]::Round($elapsed.TotalMinutes, 1)) minutos" -ForegroundColor Cyan
Write-Host "Total: $($allProperties.Count) propiedades (24 comunas)" -ForegroundColor Cyan
Write-Host "  Arriendos: $arriendos | Venta usado: $ventaUsado | Venta nuevo: $ventaNuevo" -ForegroundColor Cyan
Write-Host "Geocodificadas: $geoTotal" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Red
Write-Host ""
Write-Host "RECUERDA: Correr fix de encoding en Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host "  UPDATE scraped_properties SET comuna = 'Nunoa' WHERE comuna = 'Nunoa';" -ForegroundColor Yellow
Write-Host "  UPDATE scraped_properties SET comuna = 'Conchali' WHERE comuna = 'Conchali';" -ForegroundColor Yellow
Write-Host "  UPDATE scraped_properties SET comuna = 'Maipu' WHERE comuna = 'Maipu';" -ForegroundColor Yellow
Write-Host "  UPDATE scraped_properties SET comuna = 'Penalolen' WHERE comuna = 'Penalolen';" -ForegroundColor Yellow
Write-Host "  UPDATE scraped_properties SET comuna = 'San Joaquin' WHERE comuna = 'San Joaquin';" -ForegroundColor Yellow
Write-Host "  UPDATE scraped_properties SET comuna = 'Estacion Central' WHERE comuna = 'Estacion Central';" -ForegroundColor Yellow
