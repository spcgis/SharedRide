require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Legend",
    "esri/widgets/Expand"
], function(Map, MapView, FeatureLayer, GraphicsLayer, Legend, Expand) {

    // Initialize map
    const map = new Map({
        basemap: "gray-vector"
    });

    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-79.681, 39.932], // Fayette County coordinates
        zoom: 10
    });

    // State variables
    let selectedOrigins = new Set();
    let tripData = {};

    // Base renderers
    const greenRenderer = {
        type: "simple",
        symbol: {
            type: "simple-fill",
            color: [180, 230, 180, 0.6],
            outline: { color: [0, 128, 0], width: 1 }
        }
    };

    const darkGreenRenderer = {
        type: "simple",
        symbol: {
            type: "simple-fill",
            color: "transparent",
            outline: { color: [0, 10, 0], width: 3.5}
        }
    };

    const medGreenRenderer = {
        type: "simple",
        symbol: {
            type: "simple-fill",
            color: "transparent",
            outline: { color: [0, 50, 0], width: 2}
        }
    };

    const initialRenderer = {
        type: "simple",
        symbol: {
            type: "simple-fill",
            color: [180, 230, 180, 0.6],
            outline: { color: [0, 128, 0], width: 1 }
        },
        label: "NA - Origin Not Selected"
    };

    const destColorLayer = new GraphicsLayer({
        id: "destColorLayer"
    });

    const originOutlineLayer = new GraphicsLayer({
        id: "originOutlineLayer"
    });

    // Layers
    const blockGroupOutlineLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/MV5wh5WkCMqlwISp/ArcGIS/rest/services/FACT_Shared_Ride/FeatureServer/0",
        id: "BlockGroupOutline",
        outFields: ["*"],
        visible: true,
        opacity: 0.7,
        renderer: greenRenderer
    });

    const countyOutlineLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/MV5wh5WkCMqlwISp/ArcGIS/rest/services/County_Boundaries_TIGER/FeatureServer/126",
        id: "CountyOutline",
        outFields: ["*"],
        visible: true,
        opacity: 0.7,
        renderer: darkGreenRenderer
    })

    const municipalOutlineLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/MV5wh5WkCMqlwISp/ArcGIS/rest/services/Municipal_Boundaries_TIGER/FeatureServer/123",
        id: "MunicipalOutline",
        outFields: ["*"],
        visible: true,
        opacity: 0.7,
        renderer: medGreenRenderer
    })

    const blockGroupInteractiveLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/MV5wh5WkCMqlwISp/ArcGIS/rest/services/FACT_Shared_Ride/FeatureServer/0",
        id: "BlockGroupInteractive",
        outFields: ["*"],
        visible: true,
        opacity: 0.7,
        renderer: initialRenderer
    });

    // Trip records table
    const tripTable = new FeatureLayer({
        url: "https://services3.arcgis.com/MV5wh5WkCMqlwISp/ArcGIS/rest/services/FACT_Shared_Ride/FeatureServer/1"
    });

    map.addMany([
        blockGroupOutlineLayer,
        blockGroupInteractiveLayer, 
        destColorLayer, 
        municipalOutlineLayer, 
        countyOutlineLayer,
        originOutlineLayer
    ]);

    // Legend widget
    const legend = new Legend({
        view: view,
        style: "classic",
        layerInfos: [
            { layer: blockGroupOutlineLayer, title: "Census Block Groups" },
            { layer: municipalOutlineLayer, title: "Municipal Boundaries" },
            { layer: countyOutlineLayer, title: "County Boundaries" }
        ]
    });

    const BGlegend = new Legend({
        view: view,
        style: "classic",
        layerInfos: [
            { layer: blockGroupInteractiveLayer, title: "Drop-off Locations" }


        ]    
    });

    const legendExpand = new Expand({
        view: view,
        content: legend,
        expanded: true,
        expandIconClass: "esri-icon-legend",
        mode: "floating"
    });

    const BGlegendExpand = new Expand({
        view: view,
        content: BGlegend,
        expanded: true, 
        expandIconClass: "esri-icon-legend",
        mode: "floating"
    });

    view.ui.add(legendExpand, "bottom-right");
    view.ui.add(BGlegendExpand, "bottom-left");

    // Build UI Filter Container
    const filterDiv = document.createElement("div");
    filterDiv.id = "filterContainer";
    filterDiv.style.cssText = `
        position: absolute;
        right: 20px;
        background: white;
        padding: 10px;
        border-radius: 3px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        z-index: 1000;
        min-width: 180px;
    `;

    filterDiv.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label for="fundingSelect"><strong>Funding Source:</strong></label><br/>
            <select id="fundingSelect" style="border: 1px solid #ccc; width: 100%; margin-top: 4px;">
                <option value="ALL">All Funding Sources</option>
            </select>
        </div>
        <div style="margin-bottom: 5px;">
            <label for="dateSelect"><strong>Trip Date:</strong></label><br/>
            <select id="dateSelect" style="border: 1px solid #ccc; width: 100%; margin-top: 4px;">
                <option value="ALL">All Dates</option>
            </select>
        </div>
    `;
    view.ui.add(filterDiv, "top-right");

    // Create Filter Dropdowns from table values
    tripTable.load().then(() => {
        // Find unique Funding Sources
        const fundingQuery = tripTable.createQuery();
        fundingQuery.where = "1=1";
        fundingQuery.groupByFieldsForStatistics = ["funding_source_name"];
        fundingQuery.outStatistics = [{
            statisticType: "count",
            onStatisticField: "trip_id",
            outStatisticFieldName: "cnt"
        }];

        tripTable.queryFeatures(fundingQuery).then(res => {
            const select = document.getElementById("fundingSelect");
            res.features.forEach(f => {
                const val = f.attributes.funding_source_name;
                if (val) {
                    const opt = document.createElement("option");
                    opt.value = val;
                    opt.textContent = val;
                    select.appendChild(opt);
                }
            });
        });

        // Find unique Trip Dates and sort chronologically
        const dateQuery = tripTable.createQuery();
        dateQuery.where = "1=1";
        dateQuery.groupByFieldsForStatistics = ["trip_date"];
        dateQuery.orderByFields = ["trip_date ASC"]; // ascending order
        dateQuery.outStatistics = [{
            statisticType: "count",
            onStatisticField: "trip_id",
            outStatisticFieldName: "cnt"
        }];

        tripTable.queryFeatures(dateQuery).then(res => {
            const select = document.getElementById("dateSelect");

            // Extract valid feature records
            const rawDates = res.features
                .map(f => f.attributes.trip_date)
                .filter(val => val !== null && val !== undefined);

            // Ensure both date and string types sort correctly
            rawDates.sort((a, b) => {
                const dateA = typeof a === "number" ? a : new Date(a).getTime();
                const dateB = typeof b === "number" ? b : new Date(b).getTime();
                return dateA - dateB; // Oldest to newest
            });

            // Add sorted options to the drop-down
            rawDates.forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                // Format display text (convert timestamp to string if numeric)
                opt.textContent = typeof val === "number" ? new Date(val).toLocaleDateString() : val;
                select.appendChild(opt);
            });
        });
    });

    // Add event listeners to update map when filters change
    document.getElementById("fundingSelect").addEventListener("change", refreshAllOrigins);
    document.getElementById("dateSelect").addEventListener("change", refreshAllOrigins);

    function refreshAllOrigins() {
        tripData = {};
        if (selectedOrigins.size === 0) {
            updateDisplay();
            return;
        }
        
        // Find trip data for all selections under new filters
        const promises = Array.from(selectedOrigins).map(bgId => queryOriginTrips(bgId));
        Promise.all(promises).then(() => {
            updateDisplay();
        });
    }

    // Dynamic Class Breaks
    function generateRenderer(breaks) {
        return {
            type: "class-breaks",
            defaultSymbol: {
                type: "simple-fill",
                color: [180, 230, 180, 0.6],
                outline: { color: [0, 128, 0], width: 1 }
            },
            defaultLabel: "0 trips",
            classBreakInfos: [
                {
                    minValue: 1,
                    maxValue: breaks[0],
                    symbol: { type: "simple-fill", color: [255, 241, 169, 0.7], outline: { color: [0, 128, 0], width: 1 } },
                    label: `1-${breaks[0]} trips`
                },
                {
                    minValue: breaks[0] + 1,
                    maxValue: breaks[1],
                    symbol: { type: "simple-fill", color: [254, 204, 92, 0.7], outline: { color: [0, 128, 0], width: 1 } },
                    label: `${breaks[0] + 1}-${breaks[1]} trips`
                },
                {
                    minValue: breaks[1] + 1,
                    maxValue: breaks[2],
                    symbol: { type: "simple-fill", color: [253, 141, 60, 0.7], outline: { color: [0, 128, 0], width: 1 } },
                    label: `${breaks[1] + 1}-${breaks[2]} trips`
                },
                {
                    minValue: breaks[2] + 1,
                    maxValue: breaks[3],
                    symbol: { type: "simple-fill", color: [240, 59, 32, 0.7], outline: { color: [0, 128, 0], width: 1 } },
                    label: `${breaks[2] + 1}-${breaks[3]} trips`
                },
                {
                    minValue: breaks[3] + 1,
                    maxValue: 99999999999,
                    symbol: { type: "simple-fill", color: [189, 0, 38, 0.7], outline: { color: [0, 128, 0], width: 1 } },
                    label: `>${breaks[3]} trips`
                }
            ]
        };
    }

    function generateClassBreaks(data, numClasses = 5) {
        if (!data || data.length === 0) return [5, 10, 25, 50];
        const n = data.length;

        const mat1 = Array.from({ length: n + 1 }, () => Array(numClasses + 1).fill(0));
        const mat2 = Array.from({ length: n + 1 }, () => Array(numClasses + 1).fill(0));

        for (let i = 1; i <= numClasses; i++) {
            mat1[0][i] = 1;
            mat2[0][i] = 0;
            for (let j = 1; j <= n; j++) {
                mat2[j][i] = Infinity;
            }
        }

        let v = 0;
        for (let l = 2; l <= n; l++) {
            let s1 = 0, s2 = 0, w = 0;
            for (let m = 1; m <= l; m++) {
                const i3 = l - m + 1;
                const val = data[i3 - 1];

                s2 += val * val;
                s1 += val;
                w++;

                v = s2 - (s1 * s1) / w;
                const i4 = i3 - 1;
                if (i4 !== 0) {
                    for (let j = 2; j <= numClasses; j++) {
                        if (mat2[l][j] >= (v + mat2[i4][j - 1])) {
                            mat1[l][j] = i3;
                            mat2[l][j] = v + mat2[i4][j - 1];
                        }
                    }
                }
            }
            mat1[l][1] = 1;
            mat2[l][1] = v;
        }

        const breaks = Array(numClasses + 1).fill(0);
        breaks[numClasses] = data[data.length - 1];
        let k = n;
        for (let j = numClasses; j >= 2; j--) {
            const id = mat1[k][j] - 2;
            breaks[j - 1] = data[id];
            k = mat1[k][j] - 1;
        }
        breaks[0] = data[0];
        const roundedBreaks = breaks.map(b => Math.round(b / 5) * 5);

        return roundedBreaks.slice(1);
    }

    function getColorFromRenderer(renderer, tripCount) {
        const breakInfo = renderer.classBreakInfos.find(info => 
            tripCount >= info.minValue && tripCount <= info.maxValue
        );
        return breakInfo ? breakInfo.symbol.color : [0, 0, 0, 0];
    }

    // Map Click Handler
    view.on("click", function(event) {
        view.hitTest(event).then(function(response) {
            const result = response.results.find(r =>
                r.graphic?.layer?.id === "BlockGroupInteractive"
            );
            if (!result) {
                if (document.getElementById("sidePanel")) {
                    document.getElementById("sidePanel").style.display = "none";
                }
                return;
            }

            const clickedBGId = result.graphic.attributes.GEOID10;
            if (!clickedBGId) return;

            if (selectedOrigins.has(clickedBGId)) {
                selectedOrigins.delete(clickedBGId);
                delete tripData[clickedBGId];
                updateDisplay();
                return;
            }

            selectedOrigins.add(clickedBGId);
            queryOriginTrips(clickedBGId).then(() => {
                updateDisplay();
            });

        }).catch(error => {
            console.error("Error in hitTest:", error);
        });
    });

    // Build SQL Clause using current dropdown states
    function buildWhereClause(clickedBGId) {
        let where = `PU_GEOID = '${clickedBGId}'`;

        const fundingVal = document.getElementById("fundingSelect").value;
        const dateVal = document.getElementById("dateSelect").value;

        if (fundingVal !== "ALL") {
            where += ` AND funding_source_name = '${fundingVal}'`;
        }

        if (dateVal !== "ALL") {
            // Check if dateVal is numeric timestamp or string
            if (!isNaN(dateVal)) {
                where += ` AND trip_date = ${dateVal}`;
            } else {
                where += ` AND trip_date = '${dateVal}'`;
            }
        }

        return where;
    }

    // Server Query using Group-By
    function queryOriginTrips(clickedBGId) {
        const query = tripTable.createQuery();
        query.where = buildWhereClause(clickedBGId);
        query.groupByFieldsForStatistics = ["DO_GEOID"];
        query.outStatistics = [{
            statisticType: "count",
            onStatisticField: "trip_id",
            outStatisticFieldName: "trip_count"
        }];

        return tripTable.queryFeatures(query).then(results => {
            const aggregatedTrips = {};
            results.features.forEach(f => {
                const destId = f.attributes.DO_GEOID ? f.attributes.DO_GEOID.toString() : null;
                const count = f.attributes.trip_count || 0;
                if (destId) {
                    aggregatedTrips[destId] = count;
                }
            });
            tripData[clickedBGId] = aggregatedTrips;
        }).catch(err => {
            console.error("Error fetching aggregated trips:", err);
        });
    }

    function updateDisplay() {
    // Clear both graphics layers immediately
    destColorLayer.removeAll();
    originOutlineLayer.removeAll();

    if (selectedOrigins.size === 0) {
        const sidePanel = document.getElementById("sidePanel");
        if (sidePanel) sidePanel.style.display = "none";
        blockGroupInteractiveLayer.renderer = initialRenderer;
        return;
    }

    // Combine trips for active origins
    let combinedTrips = {};
    Object.values(tripData).forEach(originData => {
        Object.entries(originData).forEach(([destId, trips]) => {
            combinedTrips[destId] = (combinedTrips[destId] || 0) + trips;
        });
    });

    // Update class breaks dynamically
    const sortedCounts = Object.values(tripData).flatMap(destObj => Object.values(destObj)).sort((a, b) => a - b);
    if (sortedCounts.length > 0 && sortedCounts[sortedCounts.length - 1] > 200) {
        blockGroupInteractiveLayer.renderer = generateRenderer(generateClassBreaks(sortedCounts));
    } else {
        blockGroupInteractiveLayer.renderer = generateRenderer([5, 10, 25, 50]);
    }

    // Batch query for both destination and origin geometries
    const activeIds = Array.from(new Set([
        ...Array.from(selectedOrigins),
        ...Object.keys(combinedTrips)
    ])).map(id => `'${id}'`).join(",");

    if (!activeIds) return;

    const query = blockGroupInteractiveLayer.createQuery();
    query.where = `GEOID10 IN (${activeIds})`;
    query.outFields = ["GEOID10"];

    blockGroupInteractiveLayer.queryFeatures(query).then(function(results) {
        // Clear before drawing 
        destColorLayer.removeAll();
        originOutlineLayer.removeAll();

        results.features.forEach(function(f) {
            const geoid = f.attributes.GEOID10;

            // Draw destination colors
            if (combinedTrips[geoid]) {
                const tripCount = combinedTrips[geoid];
                const color = getColorFromRenderer(blockGroupInteractiveLayer.renderer, tripCount);
                destColorLayer.add({
                    geometry: f.geometry,
                    symbol: {
                        type: "simple-fill",
                        color: color,
                        outline: { color: [0, 128, 0], width: 1 }
                    }
                });
            }

            // Draw red origin outlines
            if (selectedOrigins.has(geoid)) {
                originOutlineLayer.add({
                    geometry: f.geometry,
                    symbol: {
                        type: "simple-fill",
                        color: [0, 0, 0, 0], // Transparent fill
                        outline: { color: [255, 0, 0], width: 3.5 } // Thick red outline
                    }
                });
            }
        });

        updateSidePanel(results.features.filter(f => selectedOrigins.has(f.attributes.GEOID10)));
    });
}


    function updateSidePanel(originFeatures) {
        const sidePanel = document.getElementById("sidePanel") || createSidePanel();

        let content = `
            <div style="text-align: right;">
                <button onclick="this.parentElement.parentElement.style.display='none'" 
                        style="border: none; background: none; cursor: pointer;">✕</button>
            </div>
            <h3 style="margin-block-start:0px; margin-block-end:0px;">Selected Block Groups</h3>
            <p style="margin-block-start:0px; font-size:12px; color:#555;">Trip Origins</p>

        `;

        originFeatures.forEach(feature => {
            const bgId = feature.attributes.GEOID10;
            const totalTrips = Object.values(tripData[bgId] || {}).reduce((sum, trips) => sum + trips, 0);

            content += `
                <div style="margin-bottom: 2px;">
                    <p style="margin-block-end:0px;"><strong>Block Group:</strong> ${bgId}</p>
                    <p style="margin-block-start:0px;"><strong>Total Pick-ups:</strong> ${totalTrips}</p>
                    <hr>
                </div>
            `;
        });

        sidePanel.innerHTML = content;
        sidePanel.style.display = "block";
    }

    function createSidePanel() {
    let sidePanel = document.getElementById("sidePanel");
    if (sidePanel) return sidePanel;

    sidePanel = document.createElement("div");
    sidePanel.id = "sidePanel";
    sidePanel.style.cssText = `
        position: absolute;
        left: 55px;
        top: 140px;
        background-color: #ffffff !important;
        padding: 15px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        width: 270px;
        z-index: 1000;
        display: none;
        max-height: 40vh;
        overflow-y: auto;
        box-sizing: border-box;
        border: 1px solid #ccc;
    `;

    view.container.appendChild(sidePanel);
    return sidePanel;
}
    createSidePanel();

});
