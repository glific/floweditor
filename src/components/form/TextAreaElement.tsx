import * as React from "react";

import {FormElement, FormElementProps} from './FormElement';
import {FormWidget, FormValueState} from './FormWidget';

var styles = require("./FormElement.scss");

interface TextAreaProps extends FormElementProps {
    value: string;
}

export class TextAreaElement extends FormWidget<TextAreaProps, FormValueState> {

    constructor(props: any) {
        super(props);

        this.state = {
            value: this.props.value,
            errors: []
        };

        this.onChange = this.onChange.bind(this);
    }

    onChange(event: any) {
        this.setState({
            value: event.target.value            
        });
    }
    
    validate(): boolean {
        var errors: string[] = []
        if (this.props.required){
            if (!this.state.value) {
                errors.push(this.props.name + " is required");
            }
        }
        this.setState({errors: errors});

        return errors.length == 0;
    }

    render() {
        var classes = [];
        if (this.state.errors.length > 0) {
            classes.push(styles.invalid);
        }

        return (
            <FormElement {...this.props} errors={this.state.errors}>
                <textarea className={classes.join(" ")} defaultValue={this.state.value} onChange={this.onChange}></textarea>
            </FormElement>
        )
    }
}