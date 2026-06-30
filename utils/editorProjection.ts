import proj4 from "proj4";
import { register } from 'ol/proj/proj4';
import * as proj from 'ol/proj';

export type Vn2000Zone = '3' | '6';

proj4.defs("EPSG:9210", "+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs");
register(proj4);

export const getVn2000ProjName = (centralMeridian: number, zone: Vn2000Zone) => {
    return `VN2000_DYNAMIC_${centralMeridian.toString().replace('.', '_')}_${zone}`;
};

export const registerDynamicVn2000 = (centralMeridian: number, zone: Vn2000Zone) => {
    const name = getVn2000ProjName(centralMeridian, zone);
    if (!proj.get(name)) {
        const scaleFactor = zone === '3' ? 0.9999 : 0.9996;
        const def = `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=${scaleFactor} +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs`;
        proj4.defs(name, def);
        register(proj4);
    }
    return name;
};