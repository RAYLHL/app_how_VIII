"""Build the offline ODbL street catalog; requires osmium and shapely.
Usage: python build_catalog.py region-input-dir santa-catarina.osm.pbf output-assets-dir
The input directory contains navegantes.geojson, itajai.geojson, balneario.geojson from IBGE.
"""
import json, sys, datetime
from pathlib import Path
import osmium
from shapely.geometry import shape, LineString, mapping
from shapely.prepared import prep

inputs,pbf,target=Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3])
cities=[]; geometries=[]
for name,slug,code,lat,lon in [('Navegantes','navegantes','4211306',-26.899,-48.651),('Itajaí','itajai','4208203',-26.91,-48.665),('Balneário Camboriú','balneario','4202008',-26.993,-48.635)]:
    geometry=json.loads((inputs/(slug+'.geojson')).read_text())['features'][0]['geometry']
    geom=shape(geometry)
    geometries.append((code,geom,prep(geom)))
    polygons=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    cities.append(dict(id=code,name=name,lat=lat,lon=lon,polygons=polygons))
roads=[]
class Extract(osmium.SimpleHandler):
    def way(self, way):
        kind=way.tags.get('highway')
        if not kind or kind in ('proposed','construction','steps','platform'):return
        try: points=[(n.lon,n.lat) for n in way.nodes]
        except osmium.InvalidLocationError:return
        if len(points)<2:return
        # Broad phase removes almost all of the state before polygon operations.
        if not any(-49.05<x<-48.45 and -27.25<y<-26.65 for x,y in points):return
        line=LineString(points)
        for code,area,prepared in geometries:
            if not prepared.intersects(line):continue
            part=line.intersection(area)
            parts=[part] if part.geom_type=='LineString' else list(part.geoms) if part.geom_type in ('MultiLineString','GeometryCollection') else []
            for seg in parts:
                if seg.geom_type!='LineString' or seg.length<.000005:continue
                coordinates=[[round(x,7),round(y,7)] for x,y in seg.coords]
                roads.append([way.tags.get('name',''),code,kind,coordinates])
Extract().apply_file(str(pbf),locations=True,idx='flex_mem')
roads.sort(key=lambda r:(r[1],r[0]))
target.mkdir(parents=True,exist_ok=True)
(target/'region.json').write_text(json.dumps({'source':'IBGE API v3 — malhas simplificadas, qualidade máxima','cities':cities},ensure_ascii=False,separators=(',',':')))
(target/'streets.json').write_text(json.dumps(roads,ensure_ascii=False,separators=(',',':')))
meta={'generated':datetime.date.today().isoformat(),'source':'OpenStreetMap contributors / download.openstreetmap.fr','license':'ODbL 1.0','segments':len(roads),'named_streets_per_city':{c['name']:len({r[0] for r in roads if r[1]==c['id'] and r[0]}) for c in cities}}
(target/'catalog-meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps(meta,ensure_ascii=False,indent=2))
