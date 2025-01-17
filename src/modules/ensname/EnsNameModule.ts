import Web3 from 'web3';
import ENS from 'ethereum-ens';
import { FaucetSession } from "../../session/FaucetSession";
import { BaseModule } from "../BaseModule";
import { ModuleHookAction } from "../ModuleManager";
import { defaultConfig, IEnsNameConfig } from './EnsNameConfig';
import { FaucetError } from '../../common/FaucetError';

export class EnsNameModule extends BaseModule<IEnsNameConfig> {
  protected readonly moduleDefaultConfig = defaultConfig;
  private ens: ENS;

  protected override startModule(): Promise<void> {
    this.initEnsResolver();
    this.moduleManager.addActionHook(
      this, ModuleHookAction.ClientConfig, 1, "ens config", 
      async (clientConfig: any) => {
        clientConfig[this.moduleName] = {
          required: !!this.moduleConfig.required,
        };
      }
    );
    this.moduleManager.addActionHook(this, ModuleHookAction.SessionStart, 3, "resolve ens name", (session: FaucetSession, userInput: any) => this.processSessionStart(session, userInput));
    return Promise.resolve();
  }

  protected override stopModule(): Promise<void> {
    // nothing to do
    return Promise.resolve();
  }

  protected override onConfigReload(): void {
    this.initEnsResolver();
  }

  private initEnsResolver() {
    let provider = typeof this.moduleConfig.rpcHost == "object" ? this.moduleConfig.rpcHost : new Web3.providers.HttpProvider(this.moduleConfig.rpcHost);
    this.ens = new ENS(provider, this.moduleConfig.ensAddr || undefined, Web3);
  }

  private async processSessionStart(session: FaucetSession, userInput: any): Promise<void> {
    let targetAddr: string = userInput.addr;
    let isEnsName = false;
    if(typeof targetAddr === "string" && targetAddr.match(/^[-a-zA-Z0-9@:%._\+~#=]{1,256}\.eth$/)) {
      try {
        targetAddr = await this.ens.resolver(targetAddr).addr();
        session.setTargetAddr(targetAddr);
        isEnsName = true;
      } catch(ex) {
        throw new FaucetError("INVALID_ENSNAME", "Could not resolve ENS Name '" + targetAddr + "': " + ex.toString());
      }
    }

    if(this.moduleConfig.required && !isEnsName) {
      throw new FaucetError("REQUIRE_ENSNAME", "Only ENS Names allowed.");
    }
  }

}
