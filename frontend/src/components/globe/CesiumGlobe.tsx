import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { MAP_CONFIG } from '../../config/mapConfig';
import { CameraTelemetry, MapLayerControls, MapBaseStyle } from '../../types/telemetry';
import { GeocodingResult } from '../../services/geocoding/geocodingService';
import { GodViewNode, GodViewLink, CameraItem, JunctionItem } from '../../api/godview';

interface CesiumGlobeProps {
  is3D: boolean;
  layers: MapLayerControls;
  mapStyle?: MapBaseStyle;
  selectedLocation: GeocodingResult | null;
  currentLocation: { lat: number; lon: number; accuracy?: number } | null;
  nodes?: GodViewNode[];
  cameras?: CameraItem[];
  junctions?: JunctionItem[];
  links?: GodViewLink[];
  activeScenario: string;
  selectedNodeId?: string | null;
  selectedCameraId?: string | null;
  selectedJunctionId?: string | null;
  onSelectNode?: (node: GodViewNode) => void;
  onSelectCamera?: (camera: CameraItem) => void;
  onSelectJunction?: (junction: JunctionItem) => void;
  onMapClick: (lat: number, lon: number) => void;
  onTelemetryUpdate: (telemetry: CameraTelemetry) => void;
  isPickingLocation?: boolean;
  onPickLocation?: (lat: number, lon: number) => void;
  onRegisterController: (controller: {
    flyTo: (lat: number, lon: number, altMeters: number, heading?: number, pitch?: number, duration?: number) => void;
    flyToEarth: () => void;
    flyToIndia: () => void;
    flyToTamilNadu: () => void;
    flyToTrichy: () => void;
    flyToJunction: () => void;
    set3DMode: (enable3D: boolean) => void;
    toggle2D3D: () => void;
    resetNorth: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
  }) => void;
}

export const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  is3D,
  layers,
  mapStyle = 'google_hybrid',
  selectedLocation,
  currentLocation,
  nodes = [],
  cameras = [],
  junctions = [],
  links = [],
  activeScenario,
  selectedNodeId,
  selectedCameraId,
  selectedJunctionId,
  onSelectNode,
  onSelectCamera,
  onSelectJunction,
  onMapClick,
  onTelemetryUpdate,
  isPickingLocation = false,
  onPickLocation,
  onRegisterController
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const baseLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const trafficLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const osmLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const labelsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const transLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const osmBuildingsRef = useRef<Cesium.Cesium3DTileset | null>(null);

  const selectedPinEntityRef = useRef<Cesium.Entity | null>(null);
  const currentLocationEntityRef = useRef<Cesium.Entity | null>(null);

  const cameraEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const junctionEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const linkEntitiesRef = useRef<Cesium.Entity[]>([]);
  const highlightEntitiesRef = useRef<Cesium.Entity[]>([]);
  const regionalBeaconEntityRef = useRef<Cesium.Entity | null>(null);

  // Keep references to latest callbacks to prevent stale closures in Cesium event handlers
  const callbacksRef = useRef({
    onSelectNode,
    onSelectCamera,
    onSelectJunction,
    onMapClick,
    onPickLocation,
    isPickingLocation
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectNode,
      onSelectCamera,
      onSelectJunction,
      onMapClick,
      onPickLocation,
      isPickingLocation
    };
  }, [onSelectNode, onSelectCamera, onSelectJunction, onMapClick, onPickLocation, isPickingLocation]);

  // Helper to build Google Maps / reference imagery providers (NO WATERMARKS)
  const createBaseImageryProvider = (style: MapBaseStyle = 'google_hybrid'): Cesium.ImageryProvider => {
    switch (style) {
      case 'google_roadmap':
        return new Cesium.UrlTemplateImageryProvider({
          url: MAP_CONFIG.googleRoadmapUrl,
          subdomains: ['0', '1', '2', '3'],
          maximumLevel: 20
        });
      case 'google_satellite':
        return new Cesium.UrlTemplateImageryProvider({
          url: MAP_CONFIG.googleSatelliteUrl,
          subdomains: ['0', '1', '2', '3'],
          maximumLevel: 20
        });
      case 'google_terrain':
        return new Cesium.UrlTemplateImageryProvider({
          url: MAP_CONFIG.googleTerrainUrl,
          subdomains: ['0', '1', '2', '3'],
          maximumLevel: 20
        });
      case 'esri_satellite':
        return new Cesium.UrlTemplateImageryProvider({
          url: MAP_CONFIG.esriSatelliteUrl,
          maximumLevel: 19
        });
      case 'google_hybrid':
      default:
        return new Cesium.UrlTemplateImageryProvider({
          url: MAP_CONFIG.googleHybridUrl,
          subdomains: ['0', '1', '2', '3'],
          maximumLevel: 20
        });
    }
  };

  // 1. Initialize Cesium Globe
  useEffect(() => {
    if (!containerRef.current) return;

    Cesium.Ion.defaultAccessToken = MAP_CONFIG.cesiumIonToken;

    // Authentic Google Maps Hybrid Satellite (photorealistic global satellite + roads + place labels)
    const baseProvider = createBaseImageryProvider(mapStyle);
    const baseLayer = new Cesium.ImageryLayer(baseProvider);
    baseLayerRef.current = baseLayer;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: baseLayer,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      orderIndependentTranslucency: true
    });

    // Space & globe styling matching Google Earth
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020617');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1b35');
    viewer.scene.globe.enableLighting = false; // Always clear global surveillance lighting
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    // 3D Terrain elevation
    try {
      if (is3D) {
        viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
      }
    } catch (e) {
      console.warn('World Terrain notice:', e);
    }

    // Secondary Imagery Layers (NO WATERMARKS)
    // 1. Google Live Traffic Flow Overlay (green/yellow/red congestion)
    try {
      const trafficProvider = new Cesium.UrlTemplateImageryProvider({
        url: MAP_CONFIG.googleTrafficUrl,
        subdomains: ['0', '1', '2', '3'],
        maximumLevel: 20
      });
      const trafficLayer = viewer.imageryLayers.addImageryProvider(trafficProvider);
      trafficLayer.show = Boolean(layers.traffic);
      trafficLayer.alpha = 0.95;
      trafficLayerRef.current = trafficLayer;
    } catch (e) {
      console.warn('Google Traffic layer notice:', e);
    }

    // 2. OpenStreetMap Street Layer (optional toggle)
    try {
      const osmProvider = new Cesium.OpenStreetMapImageryProvider({
        url: MAP_CONFIG.osmTileUrl
      });
      const osmLayer = viewer.imageryLayers.addImageryProvider(osmProvider);
      osmLayer.show = layers.osm;
      osmLayer.alpha = 0.85;
      osmLayerRef.current = osmLayer;
    } catch (e) {
      console.warn('OSM layer init notice:', e);
    }

    // 3. Clean Esri Reference Labels (Boundaries & Places - used in non-hybrid mode)
    try {
      const labelProvider = new Cesium.UrlTemplateImageryProvider({
        url: MAP_CONFIG.esriLabelsUrl,
        maximumLevel: 19
      });
      const labelLayer = viewer.imageryLayers.addImageryProvider(labelProvider);
      labelLayer.show = layers.labels && (mapStyle === 'google_satellite' || mapStyle === 'esri_satellite');
      labelsLayerRef.current = labelLayer;
    } catch (e) {
      console.warn('Reference labels layer notice:', e);
    }

    // 4. Clean Esri Transportation / Road Network Overlay (used in Esri mode)
    try {
      const transProvider = new Cesium.UrlTemplateImageryProvider({
        url: MAP_CONFIG.esriTransportationUrl,
        maximumLevel: 19
      });
      const transLayer = viewer.imageryLayers.addImageryProvider(transProvider);
      transLayer.show = layers.labels && mapStyle === 'esri_satellite';
      transLayer.alpha = 0.65;
      transLayerRef.current = transLayer;
    } catch (e) {
      console.warn('Transportation layer notice:', e);
    }

    viewerRef.current = viewer;

    // Initial Camera Target: Restore saved position if available, else Planetary Orbit
    let restoredFromStorage = false;
    try {
      const savedPosStr = localStorage.getItem('trafficiq_last_camera_pos');
      if (savedPosStr) {
        const savedPos = JSON.parse(savedPosStr);
        if (savedPos && savedPos.lat && savedPos.lon && savedPos.height && savedPos.height < 5000000) {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(savedPos.lon, savedPos.lat, savedPos.height),
            orientation: {
              heading: Cesium.Math.toRadians(savedPos.heading || 0),
              pitch: Cesium.Math.toRadians(savedPos.pitch || -55),
              roll: 0.0
            }
          });
          restoredFromStorage = true;
        }
      }
    } catch (e) {}

    if (!restoredFromStorage) {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 24000000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0.0
        }
      });
    }

    // Real-Time Telemetry updates on camera movement & Viewport Persistence
    const updateTelemetry = () => {
      if (!viewer.isDestroyed()) {
        const cam = viewer.camera;
        const carto = Cesium.Cartographic.fromCartesian(cam.position);
        if (carto) {
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          const altKm = carto.height / 1000.0;
          const heading = Cesium.Math.toDegrees(cam.heading);
          const pitch = Cesium.Math.toDegrees(cam.pitch);
          const roll = Cesium.Math.toDegrees(cam.roll);

          onTelemetryUpdate({
            latitude: lat,
            longitude: lon,
            altitudeKm: altKm,
            headingDeg: heading,
            pitchDeg: pitch,
            rollDeg: roll
          });

          // Persist user viewport to localStorage so refresh or reopening Edge resumes directly here
          if (carto.height < 5000000) {
            try {
              localStorage.setItem('trafficiq_last_camera_pos', JSON.stringify({
                lat,
                lon,
                height: carto.height,
                heading,
                pitch
              }));
            } catch (e) {}
          }
        }
      }
    };

    const removePostRender = viewer.scene.postRender.addEventListener(updateTelemetry);

    // Left click on Globe -> entity inspection or location pin
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const current = callbacksRef.current;

      // Robust multi-fallback surface picker for 3D tiles, OSM buildings, terrain, and globe
      const getClickCartesian = (position: Cesium.Cartesian2): Cesium.Cartesian3 | undefined => {
        // 1. Scene pickPosition (picks exact 3D surface: 3D tiles, OSM buildings, terrain, models)
        if (viewer.scene.pickPositionSupported) {
          const p = viewer.scene.pickPosition(position);
          if (Cesium.defined(p)) return p;
        }
        // 2. Camera pick ray on globe
        const ray = viewer.camera.getPickRay(position);
        if (ray) {
          const p = viewer.scene.globe.pick(ray, viewer.scene);
          if (Cesium.defined(p)) return p;
        }
        // 3. Fallback to ellipsoid intersection
        const pEllip = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
        if (Cesium.defined(pEllip)) return pEllip;
        return undefined;
      };

      // Crosshair pick mode check: ALWAYS captures coordinates wherever user clicks on map/buildings
      if (current.isPickingLocation && current.onPickLocation) {
        const cartesian = getClickCartesian(click.position);
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          current.onPickLocation(lat, lon);
          return;
        }
      }

      // Check entity pick
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        const entityType = pickedObject.id.properties.entityType?.getValue();

        // 1. Junction clicked -> open Junction Overview
        if (entityType === 'junction') {
          const juncData = pickedObject.id.properties.junction?.getValue();
          if (juncData && current.onSelectJunction) {
            current.onSelectJunction(juncData);
            return;
          }
        }

        // 2. Camera clicked -> open Single Camera Drawer
        if (entityType === 'camera') {
          const camData = pickedObject.id.properties.camera?.getValue();
          if (camData && current.onSelectCamera) {
            current.onSelectCamera(camData);
            return;
          }
        }

        // Fallback for legacy GodViewNode
        const legacyCam = pickedObject.id.properties.cameraNode?.getValue();
        if (legacyCam) {
          if (current.onSelectCamera) {
            current.onSelectCamera({
              id: legacyCam.id,
              name: legacyCam.name,
              latitude: legacyCam.lat,
              longitude: legacyCam.lon,
              direction: legacyCam.approach,
              status: legacyCam.status,
              signal: legacyCam.signal,
              count: legacyCam.count,
              queue: 5,
              plate: legacyCam.plate,
              is_ambulance: legacyCam.is_ambulance,
              is_missing: legacyCam.is_missing
            });
          } else if (current.onSelectNode) {
            current.onSelectNode(legacyCam);
          }
          return;
        }
      }

      // 3. Ground clicked (empty space, road, or 3D terrain/buildings) -> show Location Info Card with "Add Camera Here"
      const cartesian = getClickCartesian(click.position);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        current.onMapClick(lat, lon);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Register Navigation Controller Methods
    onRegisterController({
      flyTo: (lat: number, lon: number, altMeters: number, heading?: number, pitch?: number, duration = 2.0) => {
        const center = Cesium.Cartesian3.fromDegrees(lon, lat, 0.0);
        const sphere = new Cesium.BoundingSphere(center, 0.0);
        const targetHeading = (heading !== undefined && heading !== null)
          ? Cesium.Math.toRadians(heading)
          : viewer.camera.heading;
        const targetPitch = (pitch !== undefined && pitch !== null)
          ? Cesium.Math.toRadians(pitch)
          : (is3D ? Cesium.Math.toRadians(-50) : Cesium.Math.toRadians(-90));

        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(targetHeading, targetPitch, altMeters),
          duration: duration,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      },
      flyToEarth: () => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 24000000.0),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0
          },
          duration: 2.5,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      },
      flyToIndia: () => {
        const center = Cesium.Cartesian3.fromDegrees(78.9629, 21.5937, 0.0);
        const sphere = new Cesium.BoundingSphere(center, 0.0);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(0.0, Cesium.Math.toRadians(-85), 3200000.0),
          duration: 2.2,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      },
      flyToTamilNadu: () => {
        const center = Cesium.Cartesian3.fromDegrees(78.6569, 11.1271, 0.0);
        const sphere = new Cesium.BoundingSphere(center, 0.0);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(0.0, Cesium.Math.toRadians(-75), 520000.0),
          duration: 2.2,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      },
      flyToTrichy: () => {
        // Center exactly on Tiruchirappalli city center & the TrafficIQ camera network cluster (Lat 10.7905, Lon 78.6980)
        // With bounding sphere centering, Trichy city center is mathematically in the dead center of the screen
        // and Srirangam is positioned in the northern distance, NOT displacing the center!
        const center = Cesium.Cartesian3.fromDegrees(78.6980, 10.7905, 0.0);
        const sphere = new Cesium.BoundingSphere(center, 0.0);
        const targetPitch = is3D ? Cesium.Math.toRadians(-55) : Cesium.Math.toRadians(-90);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(0.0, targetPitch, 13000.0),
          duration: 2.2,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      },
      flyToJunction: () => {
        const center = Cesium.Cartesian3.fromDegrees(78.7047, 10.7905, 0.0);
        const sphere = new Cesium.BoundingSphere(center, 0.0);
        const targetPitch = is3D ? Cesium.Math.toRadians(-50) : Cesium.Math.toRadians(-90);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(0.0, targetPitch, 1300.0),
          duration: 2.0,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      },
      set3DMode: (enable3D: boolean) => {
        const targetPitch = enable3D ? -50 : -90;
        const centerCartesian = viewer.camera.pickEllipsoid(
          new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2)
        );
        if (centerCartesian) {
          const sphere = new Cesium.BoundingSphere(centerCartesian, 0.0);
          const range = Cesium.Cartesian3.distance(viewer.camera.position, centerCartesian);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(viewer.camera.heading, Cesium.Math.toRadians(targetPitch), Math.max(300, Math.min(range, 25000000))),
            duration: 1.2,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
          });
        } else {
          viewer.camera.flyTo({
            destination: viewer.camera.position,
            orientation: {
              heading: viewer.camera.heading,
              pitch: Cesium.Math.toRadians(targetPitch),
              roll: 0.0
            },
            duration: 1.2
          });
        }
      },
      toggle2D3D: () => {
        const curPitch = Cesium.Math.toDegrees(viewer.camera.pitch);
        const targetPitch = curPitch > -60 ? -90 : -50;
        const centerCartesian = viewer.camera.pickEllipsoid(
          new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2)
        );
        if (centerCartesian) {
          const sphere = new Cesium.BoundingSphere(centerCartesian, 0.0);
          const range = Cesium.Cartesian3.distance(viewer.camera.position, centerCartesian);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(viewer.camera.heading, Cesium.Math.toRadians(targetPitch), Math.max(300, Math.min(range, 25000000))),
            duration: 1.2,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
          });
        } else {
          viewer.camera.flyTo({
            destination: viewer.camera.position,
            orientation: {
              heading: viewer.camera.heading,
              pitch: Cesium.Math.toRadians(targetPitch),
              roll: 0.0
            },
            duration: 1.2
          });
        }
      },
      resetNorth: () => {
        viewer.camera.flyTo({
          destination: viewer.camera.position,
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: viewer.camera.pitch,
            roll: 0.0
          },
          duration: 1.0
        });
      },
      zoomIn: () => {
        viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.4);
      },
      zoomOut: () => {
        viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.6);
      }
    });

    // Load 3D Buildings via Cesium ion if token is present
    if (MAP_CONFIG.cesiumIonToken) {
      Cesium.createOsmBuildingsAsync()
        .then((tileset) => {
          if (!viewer.isDestroyed()) {
            osmBuildingsRef.current = tileset;
            tileset.show = is3D && layers.buildings3D;
            viewer.scene.primitives.add(tileset);
          }
        })
        .catch((err) => {
          console.warn('[CesiumGlobe] OSM 3D Buildings notice:', err);
        });
    }

    return () => {
      removePostRender();
      handler.destroy();
      if (regionalBeaconEntityRef.current) {
        try { viewer.entities.remove(regionalBeaconEntityRef.current); } catch (e) {}
        regionalBeaconEntityRef.current = null;
      }
      if (osmBuildingsRef.current && !viewer.isDestroyed()) {
        try { viewer.scene.primitives.remove(osmBuildingsRef.current); } catch (e) {}
        osmBuildingsRef.current = null;
      }
      viewer.destroy();
      viewerRef.current = null;
      baseLayerRef.current = null;
      trafficLayerRef.current = null;
      osmLayerRef.current = null;
      labelsLayerRef.current = null;
      transLayerRef.current = null;
    };
  }, []);

  // Dynamic Base Layer Switcher (Google Hybrid, Roadmap, Satellite, Terrain)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    try {
      const newProvider = createBaseImageryProvider(mapStyle);
      const newBase = new Cesium.ImageryLayer(newProvider);
      viewer.imageryLayers.add(newBase, 0);

      if (baseLayerRef.current) {
        viewer.imageryLayers.remove(baseLayerRef.current, true);
      }
      baseLayerRef.current = newBase;

      // Adjust label layers for chosen style
      if (labelsLayerRef.current) {
        labelsLayerRef.current.show = layers.labels && (mapStyle === 'google_satellite' || mapStyle === 'esri_satellite');
      }
      if (transLayerRef.current) {
        transLayerRef.current.show = layers.labels && mapStyle === 'esri_satellite';
      }
    } catch (err) {
      console.warn('Error switching map style:', err);
    }
  }, [mapStyle]);

  // Cursor handling for pick mode
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = isPickingLocation ? 'crosshair' : 'default';
    }
  }, [isPickingLocation]);

  // 2. Toggle 3D vs 2D Satellite View
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (osmBuildingsRef.current) {
      osmBuildingsRef.current.show = is3D && layers.buildings3D;
    }

    try {
      if (is3D) {
        viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
      } else {
        viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }
    } catch (e) {
      console.warn('Terrain mode notice:', e);
    }
  }, [is3D, layers.buildings3D]);

  // 3. Sync Layer Visibility
  useEffect(() => {
    if (osmLayerRef.current) osmLayerRef.current.show = layers.osm;
    if (trafficLayerRef.current) trafficLayerRef.current.show = Boolean(layers.traffic);
    if (labelsLayerRef.current) {
      labelsLayerRef.current.show = layers.labels && (mapStyle === 'google_satellite' || mapStyle === 'esri_satellite');
    }
    if (transLayerRef.current) {
      transLayerRef.current.show = layers.labels && mapStyle === 'esri_satellite';
    }
  }, [layers, mapStyle]);

  // Dynamic canvas cursor based on isPickingLocation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (viewer.scene.canvas) {
      viewer.scene.canvas.style.cursor = isPickingLocation ? 'crosshair' : 'default';
    }
  }, [isPickingLocation]);

  // Merge cameras and nodes (respects empty cameras array)
  const effectiveCameras: CameraItem[] = React.useMemo(() => {
    if (cameras !== undefined && cameras !== null) return cameras;
    return nodes.map(n => ({
      id: n.id,
      name: n.name,
      latitude: n.lat,
      longitude: n.lon,
      direction: n.approach,
      status: n.status,
      signal: n.signal,
      count: n.count,
      queue: 5,
      plate: n.plate,
      is_ambulance: n.is_ambulance,
      is_missing: n.is_missing
    }));
  }, [cameras, nodes]);

  // 4. Render Junction Entities (Diamonds with Connected Camera Count)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const currentJuncMap = junctionEntitiesRef.current;
    const activeJuncIds = new Set(junctions.map(j => `junc-node-${j.id}`));

    // Remove any stale junctions
    Array.from(currentJuncMap.keys()).forEach(id => {
      if (!activeJuncIds.has(id)) {
        const ent = currentJuncMap.get(id);
        if (ent) {
          try { viewer.entities.remove(ent); } catch (e) {}
        }
        currentJuncMap.delete(id);
      }
    });

    junctions.forEach(junc => {
      const entityId = `junc-node-${junc.id}`;
      const isSelected = selectedJunctionId === junc.id;
      const cartesian = Cesium.Cartesian3.fromDegrees(junc.longitude, junc.latitude, 22);

      const labelText = `🚦 ${junc.name || junc.id} (${junc.connected_camera_ids?.length ?? 0} CAMS)`;

      let entity = currentJuncMap.get(entityId);
      if (!entity) {
        entity = viewer.entities.add({
          id: entityId,
          name: `${junc.id} - ${junc.name}`,
          position: cartesian,
          point: {
            pixelSize: isSelected ? 22 : 16,
            color: Cesium.Color.fromCssColorString('#a855f7'), // Vibrant purple signal hub
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: isSelected ? 3 : 2,
            distanceDisplayCondition: isSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 48000.0)
          },
          label: {
            text: labelText,
            font: 'bold 11px JetBrains Mono, monospace',
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('rgba(88, 28, 135, 0.9)'),
            pixelOffset: new Cesium.Cartesian2(0, -26),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            distanceDisplayCondition: isSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 45000.0)
          },
          properties: {
            entityType: 'junction',
            junction: junc
          }
        });
        currentJuncMap.set(entityId, entity);
      } else {
        entity.show = true;
        entity.position = cartesian as any;
        if (entity.point) {
          entity.point.pixelSize = new Cesium.ConstantProperty(isSelected ? 22 : 16) as any;
          entity.point.outlineWidth = new Cesium.ConstantProperty(isSelected ? 3 : 2) as any;
          entity.point.distanceDisplayCondition = new Cesium.ConstantProperty(isSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 48000.0)) as any;
        }
        if (entity.label) {
          entity.label.text = new Cesium.ConstantProperty(labelText) as any;
          entity.label.distanceDisplayCondition = new Cesium.ConstantProperty(isSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 45000.0)) as any;
        }
        entity.properties = new Cesium.PropertyBag({
          entityType: 'junction',
          junction: junc
        });
      }
    });
  }, [junctions, selectedJunctionId]);

  // 5. Render Camera Entities at Exact Coordinates
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!layers.cameraNodes) {
      cameraEntitiesRef.current.forEach(entity => {
        entity.show = false;
      });
      return;
    }

    const currentMap = cameraEntitiesRef.current;
    const activeSelectedId = selectedCameraId || selectedNodeId;
    const activeCamIds = new Set(effectiveCameras.map(c => `cam-node-${c.id}`));

    // Remove any entities that are no longer in effectiveCameras
    Array.from(currentMap.keys()).forEach(id => {
      if (!activeCamIds.has(id)) {
        const ent = currentMap.get(id);
        if (ent) {
          try { viewer.entities.remove(ent); } catch (e) {}
        }
        currentMap.delete(id);
      }
    });

    effectiveCameras.forEach(cam => {
      const entityId = `cam-node-${cam.id}`;
      const isSelected = activeSelectedId === cam.id;
      const isJunctionCam = Boolean(cam.junction_id);

      // Color coding based on status & scenario
      let pinColor = isJunctionCam
        ? Cesium.Color.fromCssColorString('#a855f7') // Purple for junction approach cams
        : Cesium.Color.fromCssColorString('#06b6d4'); // Cyan for normal standalone cams

      if (cam.has_database_alert) {
        pinColor = Cesium.Color.fromCssColorString('#dc2626'); // Subtle red alert marker for verified DB match
      } else if (cam.is_missing) {
        pinColor = Cesium.Color.fromCssColorString('#eab308'); // Amber warning
      } else if (cam.is_ambulance && activeScenario === 'ambulance') {
        pinColor = Cesium.Color.fromCssColorString('#ef4444'); // Red emergency
      } else if (cam.signal === 'GREEN') {
        pinColor = Cesium.Color.fromCssColorString('#22c55e');
      } else if (cam.signal === 'YELLOW') {
        pinColor = Cesium.Color.fromCssColorString('#f59e0b');
      } else if (cam.signal === 'RED') {
        pinColor = Cesium.Color.fromCssColorString('#ef4444');
      }

      let labelText = isJunctionCam
        ? (cam.signal === 'GREEN'
            ? `🟢 ${cam.id} (${cam.timer ? cam.timer + 's' : 'GREEN'})`
            : cam.signal === 'YELLOW'
            ? `🟡 ${cam.id} (${cam.timer ? cam.timer + 's' : 'AMBER'})`
            : `🔴 ${cam.id} (${cam.timer ? cam.timer + 's' : 'HOLD'})`)
        : (cam.signal === 'GREEN'
            ? `🟢 ${cam.id}`
            : cam.signal === 'YELLOW'
            ? `🟡 ${cam.id}`
            : cam.signal === 'RED'
            ? `🔴 ${cam.id}`
            : `📷 ${cam.id}`);

      if (cam.has_database_alert) {
        labelText = `🚨 ${cam.id} [DB MATCH]`;
      } else if (cam.is_ambulance && activeScenario === 'ambulance') {
        labelText = `🚨 ${cam.id} [EVP]`;
      } else if (cam.is_missing) {
        labelText = `⚠ ${cam.id} [MISSING]`;
      }

      // Distance display condition:
      // Standalone Normal Cameras visible up to 250km (or selected)
      // Junction Approach Cameras visible up to 60km (or selected / parent junction selected)
      const isParentJuncSelected = Boolean(selectedJunctionId && cam.junction_id && selectedJunctionId.toUpperCase() === cam.junction_id.toUpperCase());
      const pointCondition = isJunctionCam
        ? (isSelected || isParentJuncSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 60000.0))
        : (isSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 250000.0));
      const labelCondition = isJunctionCam
        ? (isSelected || isParentJuncSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 15000.0))
        : (isSelected ? undefined : new Cesium.DistanceDisplayCondition(0.0, 35000.0));

      // EXACT Coordinates as requested — Never alter, never snap!
      const cartesian = Cesium.Cartesian3.fromDegrees(cam.longitude, cam.latitude, 14);

      let entity = currentMap.get(entityId);
      if (!entity) {
        entity = viewer.entities.add({
          id: entityId,
          name: `${cam.id} - ${cam.name}`,
          position: cartesian,
          point: {
            pixelSize: isSelected ? 16 : (isJunctionCam ? 11 : 12),
            color: pinColor,
            outlineColor: isSelected ? Cesium.Color.YELLOW : Cesium.Color.WHITE,
            outlineWidth: isSelected ? 2.5 : 1.5,
            distanceDisplayCondition: pointCondition
          },
          label: {
            text: labelText,
            font: '10px JetBrains Mono, monospace',
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('rgba(11, 16, 26, 0.85)'),
            pixelOffset: new Cesium.Cartesian2(0, -20),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            distanceDisplayCondition: labelCondition
          },
          properties: {
            entityType: 'camera',
            camera: cam
          }
        });
        currentMap.set(entityId, entity);
      } else {
        entity.show = true;
        entity.position = cartesian as any;
        if (entity.point) {
          entity.point.color = new Cesium.ConstantProperty(pinColor) as any;
          entity.point.pixelSize = new Cesium.ConstantProperty(isSelected ? 16 : (isJunctionCam ? 11 : 12)) as any;
          entity.point.outlineColor = new Cesium.ConstantProperty(isSelected ? Cesium.Color.YELLOW : Cesium.Color.WHITE) as any;
          entity.point.outlineWidth = new Cesium.ConstantProperty(isSelected ? 2.5 : 1.5) as any;
          entity.point.distanceDisplayCondition = new Cesium.ConstantProperty(pointCondition) as any;
        }
        if (entity.label) {
          entity.label.text = new Cesium.ConstantProperty(labelText) as any;
          entity.label.distanceDisplayCondition = new Cesium.ConstantProperty(labelCondition) as any;
        }
        entity.properties = new Cesium.PropertyBag({
          entityType: 'camera',
          camera: cam
        });
      }
    });
  }, [effectiveCameras, activeScenario, selectedCameraId, selectedNodeId, selectedJunctionId, layers.cameraNodes]);

  // 6. Highlight Viewing Direction Cone & Junction Connectors
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clear old highlights
    highlightEntitiesRef.current.forEach(entity => {
      try { viewer.entities.remove(entity); } catch (e) {}
    });
    highlightEntitiesRef.current = [];

    // A. If a single camera is selected, draw directional viewing ray
    const activeSelectedId = selectedCameraId || selectedNodeId;
    if (activeSelectedId) {
      const selectedCam = effectiveCameras.find(c => c.id === activeSelectedId);
      if (selectedCam) {
        const dir = (selectedCam.direction || 'North').toLowerCase();
        let heading = 0;
        if (dir.includes('north')) heading = 0;
        else if (dir.includes('east')) heading = 90;
        else if (dir.includes('south')) heading = 180;
        else if (dir.includes('west')) heading = 270;

        const rad = Cesium.Math.toRadians(heading);
        const distDeg = 0.00055; // ~60 meters
        const targetLon = selectedCam.longitude + distDeg * Math.sin(rad);
        const targetLat = selectedCam.latitude + distDeg * Math.cos(rad);

        // 1. Subtle transparent cone polygon (field-of-view wedge)
        const originLon = selectedCam.longitude;
        const originLat = selectedCam.latitude;
        const fovDegrees = 50;
        const halfFov = fovDegrees / 2;
        const numSteps = 8;
        const coneCoords: number[] = [originLon, originLat];

        for (let i = 0; i <= numSteps; i++) {
          const angle = heading - halfFov + (fovDegrees * i) / numSteps;
          const rAngle = Cesium.Math.toRadians(angle);
          const ptLon = originLon + (distDeg / Math.cos(Cesium.Math.toRadians(originLat))) * Math.sin(rAngle);
          const ptLat = originLat + distDeg * Math.cos(rAngle);
          coneCoords.push(ptLon, ptLat);
        }
        coneCoords.push(originLon, originLat);

        const coneEntity = viewer.entities.add({
          id: `camera-fov-wedge-${selectedCam.id}`,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(coneCoords),
            material: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.22)'),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.75)'),
            outlineWidth: 1.5
          }
        });
        highlightEntitiesRef.current.push(coneEntity);

        // 2. Central directional viewing vector
        const rayEntity = viewer.entities.add({
          id: `camera-view-cone-${selectedCam.id}`,
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(selectedCam.longitude, selectedCam.latitude, 14),
              Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 14)
            ],
            width: 4,
            material: new Cesium.PolylineArrowMaterialProperty(
              Cesium.Color.fromCssColorString('#38bdf8')
            )
          }
        });
        highlightEntitiesRef.current.push(rayEntity);
      }
    }

    // B. If a junction is selected, draw rays to all connected cameras
    if (selectedJunctionId) {
      const selectedJunc = junctions.find(j => j.id === selectedJunctionId);
      if (selectedJunc) {
        const juncPos = Cesium.Cartesian3.fromDegrees(selectedJunc.longitude, selectedJunc.latitude, 20);

        selectedJunc.connected_camera_ids?.forEach((camId, idx) => {
          const cam = effectiveCameras.find(c => c.id === camId);
          if (cam) {
            // Distance guard (< 500m): strictly ensure lines are only drawn to cameras physically belonging to this junction
            const dLat = (cam.latitude - selectedJunc.latitude) * 111000;
            const dLon = (cam.longitude - selectedJunc.longitude) * 111000 * Math.cos((selectedJunc.latitude * Math.PI) / 180);
            const distMeters = Math.sqrt(dLat * dLat + dLon * dLon);
            if (distMeters > 500) {
              return; // Do not connect to cameras outside the junction perimeter
            }

            const camPos = Cesium.Cartesian3.fromDegrees(cam.longitude, cam.latitude, 14);
            const feeder = viewer.entities.add({
              id: `junc-feeder-${selectedJunc.id}-${camId}-${idx}`,
              polyline: {
                positions: [juncPos, camPos],
                width: 3,
                material: new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.fromCssColorString('#c084fc'),
                  dashLength: 12.0
                })
              }
            });
            highlightEntitiesRef.current.push(feeder);
          }
        });
      }
    }
  }, [selectedCameraId, selectedNodeId, selectedJunctionId, effectiveCameras, junctions]);

  // 7. Render Road Corridor Links as 3D Polylines
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old link polylines
    linkEntitiesRef.current.forEach(entity => {
      try { viewer.entities.remove(entity); } catch (e) {}
    });
    linkEntitiesRef.current = [];

    if (!layers.roadLinks || links.length === 0) return;

    const camLookup = new Map<string, CameraItem>();
    effectiveCameras.forEach(n => camLookup.set(n.id, n));

    links.forEach((link, idx) => {
      const fromNode = camLookup.get(link.from);
      const toNode = camLookup.get(link.to);
      if (!fromNode || !toNode) return;

      const isDashed = link.type === 'dashed' || (activeScenario === 'anpr_missing' && (link.from === 'CAM-11' || link.to === 'CAM-11'));
      const isEmergency = activeScenario === 'ambulance' && (link.from === 'CAM-03' || link.to === 'CAM-03' || fromNode.is_ambulance);
      const isContinuous = activeScenario === 'anpr_continuous' && (fromNode.zone === 'ANPR_CONTINUOUS');

      let lineColor = Cesium.Color.fromCssColorString('#06b6d4'); // Default cyan
      if (isEmergency) lineColor = Cesium.Color.fromCssColorString('#ef4444');
      else if (isDashed) lineColor = Cesium.Color.fromCssColorString('#eab308');
      else if (isContinuous) lineColor = Cesium.Color.fromCssColorString('#10b981');

      const positions = [
        Cesium.Cartesian3.fromDegrees(fromNode.longitude, fromNode.latitude, 10),
        Cesium.Cartesian3.fromDegrees(toNode.longitude, toNode.latitude, 10)
      ];

      const linkEntity = viewer.entities.add({
        id: `link-${link.from}-${link.to}-${idx}`,
        name: link.name,
        polyline: {
          positions: positions,
          width: isEmergency ? 4 : (isContinuous ? 3.5 : 2.5),
          material: isDashed
            ? new Cesium.PolylineDashMaterialProperty({
                color: lineColor,
                dashLength: 16.0
              })
            : new Cesium.ColorMaterialProperty(lineColor),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 14000.0)
        }
      });

      linkEntitiesRef.current.push(linkEntity);
    });
  }, [effectiveCameras, links, activeScenario, layers.roadLinks]);

  // 8. Selected Location Pin Marker (when clicking ground or searching location)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (selectedPinEntityRef.current) {
      try { viewer.entities.remove(selectedPinEntityRef.current); } catch (e) {}
      selectedPinEntityRef.current = null;
    }

    if (selectedLocation) {
      const cartesian = Cesium.Cartesian3.fromDegrees(
        selectedLocation.longitude,
        selectedLocation.latitude,
        15
      );

      selectedPinEntityRef.current = viewer.entities.add({
        id: 'selected-location-pin',
        name: selectedLocation.name,
        position: cartesian,
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString('#ec4899'), // Magenta target pin
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3
        },
        label: {
          text: `🎯 ${selectedLocation.name}`,
          font: 'bold 11px JetBrains Mono, monospace',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.9)'),
          pixelOffset: new Cesium.Cartesian2(0, -22),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER
        }
      });
    }
  }, [selectedLocation]);

  // 9. Current User GPS Location (pulsing dot)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (currentLocationEntityRef.current) {
      try { viewer.entities.remove(currentLocationEntityRef.current); } catch (e) {}
      currentLocationEntityRef.current = null;
    }

    if (currentLocation) {
      const cartesian = Cesium.Cartesian3.fromDegrees(
        currentLocation.lon,
        currentLocation.lat,
        10
      );

      currentLocationEntityRef.current = viewer.entities.add({
        id: 'current-gps-location',
        name: 'My GPS Location',
        position: cartesian,
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: '📍 YOU ARE HERE',
          font: 'bold 10px JetBrains Mono, monospace',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(2, 6, 23, 0.85)'),
          pixelOffset: new Cesium.Cartesian2(0, -18),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER
        }
      });
    }
  }, [currentLocation]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ minHeight: '100%' }}
    />
  );
};
