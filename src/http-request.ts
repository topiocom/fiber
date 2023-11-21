import { HttpRequest as UHttpRequest, HttpResponse as UHttpResponse, getParts } from 'uWebSockets.js';
import { parseQuery } from './utils';

export interface UploadedFile {
  data: ArrayBuffer;
  filename: string;
  type: string;
}

export class HttpRequest {
  /**
   * Request user defined data
   */
  data: { [key: string]: any } = {};

  private bodyData: Buffer | null = null;
  private pattern: string;
  private req: UHttpRequest;
  private res: UHttpResponse;

  constructor(req: UHttpRequest, res: UHttpResponse, pattern: string) {
    this.req = req;
    this.res = res;
    this.pattern = pattern;
  }

  /**
   * Request body content
   */
  async body(): Promise<{ [key: string]: any }> {
    const contentType = this.req.getHeader('content-type');

    if (!contentType) return {};

    const body = this.bodyData ? this.bodyData : await this.getBody(this.res);

    if (!body) return {};

    this.bodyData = body;

    if (contentType === 'application/json' || contentType === 'application/x-www-form-urlencoded') {
      const bodyStr = body.toString();
      
      if (!bodyStr) return {};

      return contentType === 'application/json' ? JSON.parse(body.toString()) : parseQuery(body.toString());
    } else if (contentType?.startsWith('multipart/form-data')) {
      const data: any = {};

      getParts(body, contentType)?.forEach(p => {
        if (!p.type && !p.filename) data[p.name] = Buffer.from(p.data).toString();
      });

      return data;
    } else return body;
  }

  /**
   * Request body content
   */
  async files(): Promise<{ [key: string]: UploadedFile | undefined }> {
    const contentType = this.req.getHeader('content-type');

    if (!contentType) return {}

    const body = this.bodyData ? this.bodyData : await this.getBody(this.res);

    if (!body) return {};

    this.bodyData = body;

    if (contentType?.startsWith('multipart/form-data')) {
      const data: any = {};

      getParts(body, contentType)?.forEach(p => {
        if (p.type && p.filename) data[p.name] = { data: p.data, filename: p.filename, type: p.type };
      });

      return data;
    } else return {};
  }

  /**
   * Request headers
   */
  headers(): { [key: string]: string } {
    const headers: any = {};

    this.req.forEach((key, value) => headers[key] = value);

    return headers;
  }

  /**
   * Request path params
   */
  params(): { [key: string]: string } {
    const params = this.pattern.match(/:[\w]+/g);

    if (!params) return {};

    const data: any = {};

    for (let i = 0; i < params.length; i++) data[params[i].replace(':', '')] = this.req.getParameter(i);

    return data;
  }

  /**
   * Request query params
   */
  query(): { [key: string]: any } {
    const query = this.req.getQuery();

    if (query) return parseQuery(query);

    return {};
  }

  /**
   * Request URL including initial /slash
   */
  url() {
    return this.req.getUrl();
  }

  private async getBody(res: UHttpResponse): Promise<Buffer> {
    let buffer: Buffer;

    return new Promise(resolve => res.onData((ab, isLast) => {
      const chunk = Buffer.from(ab);

      if (isLast) {
        if (buffer) resolve(Buffer.concat([buffer, chunk]));
        else resolve(chunk);
      } else {
        if (buffer) buffer = Buffer.concat([buffer, chunk]);
        else buffer = Buffer.concat([chunk]);
      }
    }));
  }
}