import {mapstring} from "./mapstring.js";
import DottedMap from "dotted-map/without-countries";

const Map = () => {
    // It’s safe to re-create the map at each render, because of the
    // pre-computation it’s super fast ⚡️
    const map = new DottedMap({ map: JSON.parse(mapstring) });
  
    // map.addPin({
    //   lat: 40.73061,
    //   lng: -73.935242,
    //   svgOptions: { color: '#d6ff79', radius: 0.4 },
    // });
  
    const svgMap = map.getSVG({
      radius: 0.22,
      color: '#ff9f62',
      shape: 'circle',
      backgroundColor: '#f9f5f2',
    });
  
    return (
      <div>
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`} />
      </div>
    );
  };
  
  export default Map;
  