declare module '@google/earthengine' {
  namespace ee {
    namespace data {
      function authenticateViaPrivateKey(
        privateKey: any,
        success: () => void,
        error?: (err: Error) => void
      ): void;
    }

    function initialize(
      apiKey?: string | null,
      tileBaseUrl?: string | null,
      success?: () => void,
      error?: (err: Error) => void
    ): void;

    namespace Geometry {
      function Point(coords: number[]): any;
    }

    interface GeometryInstance {
      buffer(distance: number): any;
    }

    function ImageCollection(id: string): ImageCollectionInstance;

    interface ImageCollectionInstance {
      filterDate(start: any, end: any): ImageCollectionInstance;
      select(...bands: string[]): ImageCollectionInstance;
      mean(): any;
      reduceRegion(params: any): any;
    }

    namespace Reducer {
      function mean(): any;
      function count(): any;
    }

    function Date(date: number | string): any;
  }

  export = ee;
}
