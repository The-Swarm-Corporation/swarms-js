abstract class AgentBase {
    protected task: any;
  
    constructor(task: any) {
      this.task = task;
    }
  
    // Abstract method that must be implemented by derived classes
    abstract execute(): Promise<any>;
  
    // A method to get the task
    getTask(): any {
      return this.task;
    }
  
    // A method to check if the agent is reliable
    isReliable(): boolean {
      // Implement reliability logic here
      return this.task !== null && this.task !== undefined;
    }
  }
  
  export default AgentBase;